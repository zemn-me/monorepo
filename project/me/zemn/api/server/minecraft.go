package apiserver

import (
	"context"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/lambda"
	"github.com/zemn-me/monorepo/project/me/zemn/api/server/auth"
)

const (
	defaultMinecraftServerAddress = "zemn.me"
	minecraftRCONPort             = "25575"
	minecraftRCONTimeout          = 5 * time.Second
	minecraftWakeTimeout          = 10 * time.Second
	minecraftServerStateOffline   = "offline"
	minecraftServerStateOnline    = "online"
)

var (
	minecraftUsernameRE     = regexp.MustCompile(`^[A-Za-z0-9_]{3,16}$`)
	minecraftListResponseRE = regexp.MustCompile(`^There are ([0-9]+) of a max of ([0-9]+) players online(?::.*)?$`)
	errMinecraftRCONMissing = errors.New("minecraft rcon bridge is not configured")
)

type minecraftRCONCommander interface {
	Command(ctx context.Context, command string) (string, error)
}

type minecraftWakeRequester interface {
	Wake(ctx context.Context, reason string) error
}

type lambdaMinecraftRCONCommander struct {
	client       *lambda.Client
	functionName string
}

type lambdaMinecraftRCONRequest struct {
	Command string `json:"command"`
}

type lambdaMinecraftRCONResponse struct {
	Response string `json:"response"`
	Error    string `json:"error"`
}

type lambdaMinecraftWakeRequester struct {
	client       *lambda.Client
	functionName string
}

type lambdaMinecraftWakeRequest struct {
	Action string `json:"action"`
	Reason string `json:"reason,omitempty"`
}

type lambdaMinecraftWakeResponse struct {
	WakeRequested bool   `json:"wakeRequested"`
	Error         string `json:"error"`
}

func (c lambdaMinecraftRCONCommander) Command(ctx context.Context, command string) (string, error) {
	payload, err := json.Marshal(lambdaMinecraftRCONRequest{Command: command})
	if err != nil {
		return "", err
	}
	out, err := c.client.Invoke(ctx, &lambda.InvokeInput{
		FunctionName: aws.String(c.functionName),
		Payload:      payload,
	})
	if err != nil {
		return "", err
	}

	var response lambdaMinecraftRCONResponse
	if err := json.Unmarshal(out.Payload, &response); err != nil {
		return "", fmt.Errorf("decode minecraft rcon bridge response: %w", err)
	}
	if out.FunctionError != nil {
		if response.Error != "" {
			return "", errors.New(response.Error)
		}
		return "", fmt.Errorf("minecraft rcon bridge function error: %s", *out.FunctionError)
	}
	if response.Error != "" {
		return "", errors.New(response.Error)
	}
	return response.Response, nil
}

func (r lambdaMinecraftWakeRequester) Wake(ctx context.Context, reason string) error {
	payload, err := json.Marshal(lambdaMinecraftWakeRequest{
		Action: "wake",
		Reason: reason,
	})
	if err != nil {
		return err
	}
	out, err := r.client.Invoke(ctx, &lambda.InvokeInput{
		FunctionName: aws.String(r.functionName),
		Payload:      payload,
	})
	if err != nil {
		return err
	}

	var response lambdaMinecraftWakeResponse
	if len(out.Payload) > 0 {
		if err := json.Unmarshal(out.Payload, &response); err != nil {
			return fmt.Errorf("decode minecraft wake response: %w", err)
		}
	}
	if out.FunctionError != nil {
		if response.Error != "" {
			return errors.New(response.Error)
		}
		return fmt.Errorf("minecraft wake function error: %s", *out.FunctionError)
	}
	if response.Error != "" {
		return errors.New(response.Error)
	}
	return nil
}

type directMinecraftRCONCommander struct {
	address  string
	password string
	timeout  time.Duration
}

type rconPacket struct {
	id   int32
	typ  int32
	body string
}

func (c directMinecraftRCONCommander) Command(ctx context.Context, command string) (string, error) {
	dialer := net.Dialer{Timeout: c.timeout}
	conn, err := dialer.DialContext(ctx, "tcp", c.address)
	if err != nil {
		return "", err
	}
	defer conn.Close()

	if deadline, ok := ctx.Deadline(); ok {
		if err := conn.SetDeadline(deadline); err != nil {
			return "", err
		}
	} else if c.timeout > 0 {
		if err := conn.SetDeadline(time.Now().Add(c.timeout)); err != nil {
			return "", err
		}
	}

	if err := writeRCONPacket(conn, rconPacket{id: 1, typ: 3, body: c.password}); err != nil {
		return "", fmt.Errorf("send minecraft rcon auth: %w", err)
	}
	authPacket, err := readRCONPacket(conn)
	if err != nil {
		return "", fmt.Errorf("read minecraft rcon auth: %w", err)
	}
	if authPacket.id == -1 {
		return "", errors.New("minecraft rcon authentication failed")
	}

	if err := writeRCONPacket(conn, rconPacket{id: 2, typ: 2, body: command}); err != nil {
		return "", fmt.Errorf("send minecraft rcon command: %w", err)
	}
	responsePacket, err := readRCONPacket(conn)
	if err != nil {
		return "", fmt.Errorf("read minecraft rcon command response: %w", err)
	}
	if responsePacket.id != 2 {
		return "", fmt.Errorf("unexpected minecraft rcon response id %d", responsePacket.id)
	}
	return responsePacket.body, nil
}

func writeRCONPacket(w io.Writer, packet rconPacket) error {
	body := []byte(packet.body)
	size := int32(4 + 4 + len(body) + 2)
	buf := make([]byte, 4+size)
	binary.LittleEndian.PutUint32(buf[0:4], uint32(size))
	binary.LittleEndian.PutUint32(buf[4:8], uint32(packet.id))
	binary.LittleEndian.PutUint32(buf[8:12], uint32(packet.typ))
	copy(buf[12:], body)
	_, err := w.Write(buf)
	return err
}

func readRCONPacket(r io.Reader) (rconPacket, error) {
	var sizeBuf [4]byte
	if _, err := io.ReadFull(r, sizeBuf[:]); err != nil {
		return rconPacket{}, err
	}
	size := int(binary.LittleEndian.Uint32(sizeBuf[:]))
	if size < 10 || size > 4096 {
		return rconPacket{}, fmt.Errorf("invalid minecraft rcon packet size %d", size)
	}
	buf := make([]byte, size)
	if _, err := io.ReadFull(r, buf); err != nil {
		return rconPacket{}, err
	}
	if buf[len(buf)-1] != 0 || buf[len(buf)-2] != 0 {
		return rconPacket{}, errors.New("minecraft rcon packet missing terminator")
	}
	return rconPacket{
		id:   int32(binary.LittleEndian.Uint32(buf[0:4])),
		typ:  int32(binary.LittleEndian.Uint32(buf[4:8])),
		body: string(buf[8 : len(buf)-2]),
	}, nil
}

func minecraftRCONCommanderFromEnv(cfg aws.Config) minecraftRCONCommander {
	if functionName := os.Getenv("MINECRAFT_RCON_BRIDGE_FUNCTION_NAME"); functionName != "" {
		return lambdaMinecraftRCONCommander{
			client:       lambda.NewFromConfig(cfg),
			functionName: functionName,
		}
	}

	address := os.Getenv("MINECRAFT_RCON_ADDRESS")
	password := os.Getenv("MINECRAFT_RCON_PASSWORD")
	if address == "" || password == "" {
		return nil
	}
	if _, _, err := net.SplitHostPort(address); err != nil {
		address = net.JoinHostPort(address, minecraftRCONPort)
	}
	return directMinecraftRCONCommander{
		address:  address,
		password: password,
		timeout:  minecraftRCONTimeout,
	}
}

func minecraftWakeRequesterFromEnv(cfg aws.Config) minecraftWakeRequester {
	if functionName := os.Getenv("MINECRAFT_WAKE_FUNCTION_NAME"); functionName != "" {
		return lambdaMinecraftWakeRequester{
			client:       lambda.NewFromConfig(cfg),
			functionName: functionName,
		}
	}
	return nil
}

func minecraftServerAddressFromEnv() string {
	if v := strings.TrimSpace(os.Getenv("MINECRAFT_SERVER_ADDRESS")); v != "" {
		return v
	}
	return defaultMinecraftServerAddress
}

func parseMinecraftListResponse(response string) (onlinePlayers int, maxPlayers int, err error) {
	matches := minecraftListResponseRE.FindStringSubmatch(strings.TrimSpace(response))
	if matches == nil {
		return 0, 0, fmt.Errorf("unexpected minecraft list response: %q", response)
	}
	onlinePlayers, err = strconv.Atoi(matches[1])
	if err != nil {
		return 0, 0, err
	}
	maxPlayers, err = strconv.Atoi(matches[2])
	if err != nil {
		return 0, 0, err
	}
	return onlinePlayers, maxPlayers, nil
}

func minecraftError(cause string) Error {
	return Error{Cause: cause}
}

func minecraftUsernameInvalid(username string) bool {
	return !minecraftUsernameRE.MatchString(username)
}

func (s Server) runMinecraftRCON(ctx context.Context, command string) (string, error) {
	if s.minecraftRCON == nil {
		return "", errMinecraftRCONMissing
	}
	ctx, cancel := context.WithTimeout(ctx, minecraftRCONTimeout)
	defer cancel()
	return s.minecraftRCON.Command(ctx, command)
}

func (s Server) GetMinecraftStatus(ctx context.Context, rq GetMinecraftStatusRequestObject) (GetMinecraftStatusResponseObject, error) {
	status := MinecraftStatus{
		ServerAddress: s.minecraftServerAddress,
		ServerState:   minecraftServerStateOffline,
		OnlinePlayers: 0,
		RconReachable: false,
	}

	response, err := s.runMinecraftRCON(ctx, "list")
	if err != nil {
		message := err.Error()
		status.Message = &message
		return GetMinecraftStatus200JSONResponse(status), nil
	}

	onlinePlayers, maxPlayers, err := parseMinecraftListResponse(response)
	if err != nil {
		return GetMinecraftStatus503JSONResponse(minecraftError(err.Error())), nil
	}

	status.OnlinePlayers = onlinePlayers
	status.MaxPlayers = &maxPlayers
	status.RconReachable = true
	status.ServerState = minecraftServerStateOnline
	message := strings.TrimSpace(response)
	if message != "" {
		status.Message = &message
	}
	return GetMinecraftStatus200JSONResponse(status), nil
}

func (s Server) PostMinecraftWake(ctx context.Context, rq PostMinecraftWakeRequestObject) (PostMinecraftWakeResponseObject, error) {
	if s.minecraftWake == nil {
		return PostMinecraftWake503JSONResponse(minecraftError("minecraft wake bridge is not configured")), nil
	}

	ctx, cancel := context.WithTimeout(ctx, minecraftWakeTimeout)
	defer cancel()
	if err := s.minecraftWake.Wake(ctx, "minecraft page load"); err != nil {
		return PostMinecraftWake503JSONResponse(minecraftError(err.Error())), nil
	}

	message := "Wake-up requested"
	return PostMinecraftWake202JSONResponse(MinecraftWake{
		ServerAddress: s.minecraftServerAddress,
		WakeRequested: true,
		Message:       &message,
	}), nil
}

func minecraftUserInfoFromContext(ctx context.Context) (*auth.IDToken, error) {
	info, ok := auth.UserInfoFromContext(ctx)
	if !ok || info == nil || info.Subject == "" {
		return nil, errors.New("missing subject in context")
	}
	return info, nil
}

func (s Server) minecraftUserRecord(ctx context.Context, info *auth.IDToken) (*userRecord, error) {
	if s.usersTableName == "" {
		return nil, errors.New("users table is not configured")
	}

	rec, err := s.findUserByLocalID(ctx, info.Subject)
	if err != nil {
		return nil, err
	}
	if rec != nil {
		return rec, nil
	}

	scopes, err := s.resolveScopes(ctx, info.Issuer, info.Subject)
	if err != nil {
		return nil, err
	}
	hardcodedScopes := hardcodedScopesForSubject(OIDCSubject(info.Subject))
	hasHardcodedScopes := len(hardcodedScopes) > 0
	if scopes == nil && hasHardcodedScopes {
		scopes = hardcodedScopes
	}

	rec = &userRecord{
		Id:         info.Subject,
		When:       Now(),
		Deleted:    false,
		Deletable:  !isHardcodedSubject(info.Subject) && !hasHardcodedScopes,
		Scopes:     append([]string(nil), scopes...),
		GivenName:  info.GivenName,
		FamilyName: info.FamilyName,
	}
	if info.Email != "" {
		rec.Emails = addEmail(rec.Emails, canonicalEmail(info.Email))
	}
	if info.Issuer != "" {
		rec.SubjectIds = addSubjectID(rec.SubjectIds, info.Issuer, info.Subject)
		rec.Issuer = info.Issuer
		rec.RemoteSubject = info.Subject
	}
	return rec, nil
}

func (s Server) GetMinecraftWhitelist(ctx context.Context, rq GetMinecraftWhitelistRequestObject) (GetMinecraftWhitelistResponseObject, error) {
	info, err := minecraftUserInfoFromContext(ctx)
	if err != nil {
		return nil, err
	}
	rec, err := s.findUserByLocalID(ctx, info.Subject)
	if err != nil {
		return nil, err
	}
	resp := MinecraftWhitelist{
		ServerAddress: s.minecraftServerAddress,
	}
	if rec != nil && rec.MinecraftUsername != "" {
		username := rec.MinecraftUsername
		resp.Username = &username
	}
	return GetMinecraftWhitelist200JSONResponse(resp), nil
}

func (s Server) PutMinecraftWhitelist(ctx context.Context, rq PutMinecraftWhitelistRequestObject) (PutMinecraftWhitelistResponseObject, error) {
	if rq.Body == nil {
		return PutMinecraftWhitelist400JSONResponse(minecraftError("missing request body")), nil
	}
	username := strings.TrimSpace(rq.Body.Username)
	if minecraftUsernameInvalid(username) {
		return PutMinecraftWhitelist400JSONResponse(minecraftError("minecraft username must be 3-16 letters, numbers, or underscores")), nil
	}

	info, err := minecraftUserInfoFromContext(ctx)
	if err != nil {
		return nil, err
	}
	rec, err := s.minecraftUserRecord(ctx, info)
	if err != nil {
		return nil, err
	}

	if rec.MinecraftUsername != username {
		if _, err := s.runMinecraftRCON(ctx, "whitelist add "+username); err != nil {
			return PutMinecraftWhitelist503JSONResponse(minecraftError(err.Error())), nil
		}
		if rec.MinecraftUsername != "" {
			if _, err := s.runMinecraftRCON(ctx, "whitelist remove "+rec.MinecraftUsername); err != nil {
				return PutMinecraftWhitelist503JSONResponse(minecraftError(err.Error())), nil
			}
		}

		rec.MinecraftUsername = username
		rec.When = Now()
		if err := s.putUserRecord(ctx, *rec); err != nil {
			return nil, err
		}
	}

	return PutMinecraftWhitelist200JSONResponse(MinecraftWhitelist{
		ServerAddress: s.minecraftServerAddress,
		Username:      &username,
	}), nil
}

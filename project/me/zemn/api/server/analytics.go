package apiserver

import (
	"context"
	"encoding/base64"
	"fmt"
	"net"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
)

type analyticsEventRecord struct {
	Id         string         `dynamodbav:"id"`
	When       string         `dynamodbav:"when"`
	ReceivedAt Time           `dynamodbav:"received_at"`
	Origin     string         `dynamodbav:"origin,omitempty"`
	SourceIp   string         `dynamodbav:"source_ip,omitempty"`
	Event      AnalyticsEvent `dynamodbav:"event"`
}

type analyticsRequestContextKey string

const analyticsSourceIPContextKey analyticsRequestContextKey = "analytics.source_ip"
const analyticsOriginContextKey analyticsRequestContextKey = "analytics.origin"
const defaultAdminAnalyticsEventsLimit int32 = 25
const maxAdminAnalyticsEventsLimit int32 = 100

func analyticsEventSortKey(event AnalyticsEvent) string {
	return fmt.Sprintf("%s#%s", event.EventTime.UTC().Format(time.RFC3339Nano), event.EventId)
}

func (s Server) PostAnalyticsBeacon(ctx context.Context, rq PostAnalyticsBeaconRequestObject) (PostAnalyticsBeaconResponseObject, error) {
	if rq.Body == nil {
		return nil, fmt.Errorf("analytics event body is required")
	}

	record := analyticsEventRecord{
		Id:         rq.Body.SessionId,
		When:       analyticsEventSortKey(*rq.Body),
		ReceivedAt: Now(),
		Origin:     analyticsOrigin(ctx),
		SourceIp:   analyticsSourceIP(ctx),
		Event:      *rq.Body,
	}

	item, err := attributevalue.MarshalMap(record)
	if err != nil {
		return nil, err
	}

	if _, err = s.ddb.PutItem(ctx, &dynamodb.PutItemInput{
		TableName: aws.String(s.analyticsTableName),
		Item:      item,
	}); err != nil {
		return nil, err
	}

	return PostAnalyticsBeacon202JSONResponse{
		Accepted: true,
	}, nil
}

func (s Server) GetAdminAnalyticsEvents(ctx context.Context, rq GetAdminAnalyticsEventsRequestObject) (GetAdminAnalyticsEventsResponseObject, error) {
	limit := defaultAdminAnalyticsEventsLimit
	if rq.Params.Limit != nil {
		limit = int32(*rq.Params.Limit)
	}
	if limit < 1 {
		limit = 1
	}
	if limit > maxAdminAnalyticsEventsLimit {
		limit = maxAdminAnalyticsEventsLimit
	}

	offset, err := decodeAnalyticsCursor(rq.Params.Cursor)
	if err != nil {
		return nil, err
	}

	events, err := s.scanAdminAnalyticsEvents(ctx)
	if err != nil {
		return nil, err
	}

	sort.Slice(events, func(i, j int) bool {
		return events[i].When > events[j].When
	})

	if offset > len(events) {
		offset = len(events)
	}
	end := offset + int(limit)
	if end > len(events) {
		end = len(events)
	}
	nextCursor := encodeAnalyticsCursor(end, len(events))

	return GetAdminAnalyticsEvents200JSONResponse{
		Events:     events[offset:end],
		NextCursor: nextCursor,
	}, nil
}

func (s Server) scanAdminAnalyticsEvents(ctx context.Context) ([]AdminAnalyticsEvent, error) {
	events := []AdminAnalyticsEvent{}
	var exclusiveStartKey map[string]types.AttributeValue
	for {
		out, err := s.ddb.Scan(ctx, &dynamodb.ScanInput{
			TableName:         aws.String(s.analyticsTableName),
			ExclusiveStartKey: exclusiveStartKey,
		})
		if err != nil {
			return nil, err
		}

		for _, item := range out.Items {
			var record analyticsEventRecord
			if err := attributevalue.UnmarshalMap(item, &record); err != nil {
				return nil, err
			}
			events = append(events, adminAnalyticsEventFromRecord(record))
		}

		if len(out.LastEvaluatedKey) == 0 {
			return events, nil
		}
		exclusiveStartKey = out.LastEvaluatedKey
	}
}

func adminAnalyticsEventFromRecord(record analyticsEventRecord) AdminAnalyticsEvent {
	return AdminAnalyticsEvent{
		Id:         record.Id,
		When:       record.When,
		ReceivedAt: record.ReceivedAt.Time,
		Origin:     optionalString(record.Origin),
		SourceIp:   optionalString(record.SourceIp),
		Event:      record.Event,
	}
}

func optionalString(value string) *string {
	if value == "" {
		return nil
	}
	return &value
}

func decodeAnalyticsCursor(cursor *string) (int, error) {
	if cursor == nil || *cursor == "" {
		return 0, nil
	}

	decoded, err := base64.RawURLEncoding.DecodeString(*cursor)
	if err != nil {
		return 0, fmt.Errorf("decode analytics cursor: %w", err)
	}

	offset, err := strconv.Atoi(string(decoded))
	if err != nil {
		return 0, fmt.Errorf("parse analytics cursor: %w", err)
	}
	if offset < 0 {
		return 0, fmt.Errorf("analytics cursor offset is negative")
	}
	return offset, nil
}

func encodeAnalyticsCursor(nextOffset int, total int) *string {
	if nextOffset >= total {
		return nil
	}

	cursor := base64.RawURLEncoding.EncodeToString([]byte(strconv.Itoa(nextOffset)))
	return &cursor
}

func analyticsRequestContext(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := context.WithValue(r.Context(), analyticsSourceIPContextKey, requestSourceIP(r))
		ctx = context.WithValue(ctx, analyticsOriginContextKey, r.Header.Get("Origin"))
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func analyticsOrigin(ctx context.Context) string {
	v, _ := ctx.Value(analyticsOriginContextKey).(string)
	return v
}

func analyticsSourceIP(ctx context.Context) string {
	v, _ := ctx.Value(analyticsSourceIPContextKey).(string)
	return v
}

func requestSourceIP(r *http.Request) string {
	forwarded := r.Header.Get("X-Forwarded-For")
	if forwarded != "" {
		parts := strings.Split(forwarded, ",")
		if len(parts) > 0 {
			return strings.TrimSpace(parts[0])
		}
	}

	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err == nil {
		return host
	}

	return r.RemoteAddr
}

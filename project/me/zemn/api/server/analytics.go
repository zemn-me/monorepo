package apiserver

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
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
	Feed       string         `dynamodbav:"feed,omitempty"`
	ReceivedAt Time           `dynamodbav:"received_at"`
	Origin     string         `dynamodbav:"origin,omitempty"`
	SourceIp   string         `dynamodbav:"source_ip,omitempty"`
	Event      AnalyticsEvent `dynamodbav:"event"`
}

type analyticsRequestContextKey string
type analyticsCursor struct {
	Id   string `json:"id"`
	When string `json:"when"`
	Feed string `json:"feed"`
}

const analyticsSourceIPContextKey analyticsRequestContextKey = "analytics.source_ip"
const analyticsOriginContextKey analyticsRequestContextKey = "analytics.origin"
const analyticsFeed = "events"
const analyticsFeedIndexName = "feed-when-index"
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
		Feed:       analyticsFeed,
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

	exclusiveStartKey, err := decodeAnalyticsCursor(rq.Params.Cursor)
	if err != nil {
		return nil, err
	}

	out, err := s.ddb.Query(ctx, &dynamodb.QueryInput{
		TableName:              aws.String(s.analyticsTableName),
		IndexName:              aws.String(analyticsFeedIndexName),
		KeyConditionExpression: aws.String("feed = :feed"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":feed": &types.AttributeValueMemberS{Value: analyticsFeed},
		},
		ExclusiveStartKey: exclusiveStartKey,
		Limit:             aws.Int32(limit),
		ScanIndexForward:  aws.Bool(false),
	})
	if err != nil {
		return nil, err
	}

	events := make([]AdminAnalyticsEvent, 0, len(out.Items))
	for _, item := range out.Items {
		var record analyticsEventRecord
		if err := attributevalue.UnmarshalMap(item, &record); err != nil {
			return nil, err
		}
		events = append(events, adminAnalyticsEventFromRecord(record))
	}

	return GetAdminAnalyticsEvents200JSONResponse{
		Events:     events,
		NextCursor: encodeAnalyticsCursor(out.LastEvaluatedKey),
	}, nil
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

func decodeAnalyticsCursor(cursor *string) (map[string]types.AttributeValue, error) {
	if cursor == nil || *cursor == "" {
		return nil, nil
	}

	decoded, err := base64.RawURLEncoding.DecodeString(*cursor)
	if err != nil {
		return nil, fmt.Errorf("decode analytics cursor: %w", err)
	}

	var value analyticsCursor
	if err := json.Unmarshal(decoded, &value); err != nil {
		return nil, fmt.Errorf("parse analytics cursor: %w", err)
	}
	if value.Id == "" || value.When == "" || value.Feed == "" {
		return nil, fmt.Errorf("analytics cursor is missing key fields")
	}

	return map[string]types.AttributeValue{
		"id":   &types.AttributeValueMemberS{Value: value.Id},
		"when": &types.AttributeValueMemberS{Value: value.When},
		"feed": &types.AttributeValueMemberS{Value: value.Feed},
	}, nil
}

func encodeAnalyticsCursor(lastEvaluatedKey map[string]types.AttributeValue) *string {
	if len(lastEvaluatedKey) == 0 {
		return nil
	}

	value := analyticsCursor{
		Id:   attributeValueString(lastEvaluatedKey["id"]),
		When: attributeValueString(lastEvaluatedKey["when"]),
		Feed: attributeValueString(lastEvaluatedKey["feed"]),
	}
	if value.Id == "" || value.When == "" || value.Feed == "" {
		return nil
	}

	encoded, err := json.Marshal(value)
	if err != nil {
		return nil
	}
	cursor := base64.RawURLEncoding.EncodeToString(encoded)
	return &cursor
}

func attributeValueString(value types.AttributeValue) string {
	s, ok := value.(*types.AttributeValueMemberS)
	if !ok {
		return ""
	}
	return s.Value
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

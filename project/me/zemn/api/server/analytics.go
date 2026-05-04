package apiserver

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
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

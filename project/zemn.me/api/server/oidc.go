package apiserver

import (
	"context"
)

func IssueIdToken(ctx context.Context, token IdToken) (string, error) {
	return IssueJWT(ctx, signingKeyId, token)
}

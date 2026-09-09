package auth

import (
	"net/http"
	"net/url"
	"testing"
	"time"
)

func TestPusherChannelAuth(t *testing.T) {
	appKey := "278d425bdf160c73bde0"
	appSecret := "7ad3773142a6692b25b8"
	socketID := "1234.5678"
	channel := "private-test"

	authStr := GenerateChannelAuth(appKey, appSecret, socketID, channel, "")
	if !VerifyChannelAuth(authStr, appKey, appSecret, socketID, channel, "") {
		t.Fatalf("Channel auth verification failed")
	}

	// Tampered auth
	if VerifyChannelAuth("tampered:sig", appKey, appSecret, socketID, channel, "") {
		t.Fatalf("Expected tampered auth to fail")
	}

	// Presence channel with channel_data
	presenceChannel := "presence-chat"
	channelData := `{"user_id":"101","user_info":{"name":"Alice"}}`
	presenceAuth := GenerateChannelAuth(appKey, appSecret, socketID, presenceChannel, channelData)

	if !VerifyChannelAuth(presenceAuth, appKey, appSecret, socketID, presenceChannel, channelData) {
		t.Fatalf("Presence channel auth verification failed")
	}
}

func TestPusherRESTSigning(t *testing.T) {
	appKey := "app-key-1"
	appSecret := "app-secret-1"
	method := "POST"
	path := "/apps/100/events"
	body := []byte(`{"name":"test_event","channels":["my-channel"],"data":"hello"}`)
	now := time.Now()

	params := make(url.Values)
	_, signedParams := SignRESTRequest(method, path, appKey, appSecret, params, body, now)

	req, err := http.NewRequest(method, path+"?"+signedParams.Encode(), nil)
	if err != nil {
		t.Fatalf("Failed to create request: %v", err)
	}

	err = VerifyRESTRequest(req, appSecret, body, 5*time.Minute)
	if err != nil {
		t.Fatalf("REST request verification failed: %v", err)
	}
}

func TestJWTAndBcrypt(t *testing.T) {
	password := "SecretP@ss123"
	hash, err := HashPassword(password)
	if err != nil {
		t.Fatalf("HashPassword failed: %v", err)
	}

	if !CheckPasswordHash(password, hash) {
		t.Fatalf("Password verification failed")
	}

	jwtSecret := "test-jwt-secret-very-long"
	token, err := GenerateJWT("usr_123", "test@khajumsanjog.com", "admin", jwtSecret, time.Hour)
	if err != nil {
		t.Fatalf("GenerateJWT failed: %v", err)
	}

	claims, err := ValidateJWT(token, jwtSecret)
	if err != nil {
		t.Fatalf("ValidateJWT failed: %v", err)
	}

	if claims.UserID != "usr_123" || claims.Email != "test@khajumsanjog.com" {
		t.Fatalf("Claims mismatch: %+v", claims)
	}
}

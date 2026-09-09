package auth

import (
	"crypto/hmac"
	"crypto/md5"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"
)

var (
	ErrInvalidSignature = errors.New("auth: invalid signature")
	ErrExpiredTimestamp = errors.New("auth: timestamp expired or invalid")
	ErrInvalidMD5       = errors.New("auth: body md5 mismatch")
	ErrMissingAuthKey   = errors.New("auth: missing auth_key")
)

// GenerateChannelAuth generates the Pusher channel authorization string: "app_key:hex(hmac(secret, socket_id:channel[:data]))"
func GenerateChannelAuth(appKey, appSecret, socketID, channelName, channelData string) string {
	var stringToSign string
	if channelData != "" {
		stringToSign = fmt.Sprintf("%s:%s:%s", socketID, channelName, channelData)
	} else {
		stringToSign = fmt.Sprintf("%s:%s", socketID, channelName)
	}

	mac := hmac.New(sha256.New, []byte(appSecret))
	mac.Write([]byte(stringToSign))
	signature := hex.EncodeToString(mac.Sum(nil))

	return fmt.Sprintf("%s:%s", appKey, signature)
}

// VerifyChannelAuth validates client-provided channel authorization against app secret.
func VerifyChannelAuth(providedAuth, appKey, appSecret, socketID, channelName, channelData string) bool {
	expected := GenerateChannelAuth(appKey, appSecret, socketID, channelName, channelData)
	return hmac.Equal([]byte(providedAuth), []byte(expected))
}

// SignRESTRequest signs a REST API request in accordance with Pusher HTTP specification.
func SignRESTRequest(method, path, appKey, appSecret string, queryParams url.Values, body []byte, timestamp time.Time) (string, url.Values) {
	params := make(url.Values)
	for k, v := range queryParams {
		params[k] = v
	}

	params.Set("auth_key", appKey)
	params.Set("auth_timestamp", strconv.FormatInt(timestamp.Unix(), 10))
	params.Set("auth_version", "1.0")

	if len(body) > 0 {
		hash := md5.Sum(body)
		params.Set("body_md5", hex.EncodeToString(hash[:]))
	}

	stringToSign := BuildRESTStringToSign(method, path, params)

	mac := hmac.New(sha256.New, []byte(appSecret))
	mac.Write([]byte(stringToSign))
	signature := hex.EncodeToString(mac.Sum(nil))

	params.Set("auth_signature", signature)
	return signature, params
}

// BuildRESTStringToSign constructs the canonical string to sign for Pusher REST HTTP requests.
func BuildRESTStringToSign(method, path string, params url.Values) string {
	keys := make([]string, 0, len(params))
	for k := range params {
		if k == "auth_signature" {
			continue
		}
		keys = append(keys, k)
	}
	sort.Strings(keys)

	var pairs []string
	for _, k := range keys {
		val := params.Get(k)
		pairs = append(pairs, fmt.Sprintf("%s=%s", k, val))
	}
	sortedQuery := strings.Join(pairs, "&")

	return fmt.Sprintf("%s\n%s\n%s", strings.ToUpper(method), path, sortedQuery)
}

// VerifyRESTRequest verifies that an incoming HTTP request conforms to Pusher HMAC signing.
func VerifyRESTRequest(r *http.Request, appSecret string, body []byte, maxAge time.Duration) error {
	params := r.URL.Query()

	authKey := params.Get("auth_key")
	if authKey == "" {
		return ErrMissingAuthKey
	}

	authTimestampStr := params.Get("auth_timestamp")
	if authTimestampStr == "" {
		return ErrExpiredTimestamp
	}

	tsInt, err := strconv.ParseInt(authTimestampStr, 10, 64)
	if err != nil {
		return ErrExpiredTimestamp
	}

	reqTime := time.Unix(tsInt, 0)
	if maxAge > 0 && time.Since(reqTime).Abs() > maxAge {
		return ErrExpiredTimestamp
	}

	expectedMD5 := params.Get("body_md5")
	if len(body) > 0 {
		hash := md5.Sum(body)
		calculatedMD5 := hex.EncodeToString(hash[:])
		if expectedMD5 != "" && expectedMD5 != calculatedMD5 {
			return ErrInvalidMD5
		}
	}

	providedSignature := params.Get("auth_signature")
	if providedSignature == "" {
		return ErrInvalidSignature
	}

	stringToSign := BuildRESTStringToSign(r.Method, r.URL.Path, params)
	mac := hmac.New(sha256.New, []byte(appSecret))
	mac.Write([]byte(stringToSign))
	expectedSignature := hex.EncodeToString(mac.Sum(nil))

	if !hmac.Equal([]byte(providedSignature), []byte(expectedSignature)) {
		return ErrInvalidSignature
	}

	return nil
}

// SignWebhook computes the HMAC-SHA256 signature for a webhook payload.
func SignWebhook(secret string, body []byte) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(body)
	return hex.EncodeToString(mac.Sum(nil))
}

// VerifyWebhook verifies that an incoming webhook request body matches the signature.
func VerifyWebhook(secret string, body []byte, signature string) bool {
	expected := SignWebhook(secret, body)
	return hmac.Equal([]byte(signature), []byte(expected))
}

package models

import (
	"encoding/json"
	"time"
)

type User struct {
	ID           string    `json:"id"`
	Email        string    `json:"email"`
	PasswordHash string    `json:"-"`
	Role         string    `json:"role"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type App struct {
	ID                    string    `json:"id"`
	Name                  string    `json:"name"`
	AppKey                string    `json:"app_key"`
	AppSecret             string    `json:"app_secret,omitempty"` // plaintext when returned to user or decrypted
	SecretCiphertext      string    `json:"-"`
	OwnerID               string    `json:"owner_id"`
	Cluster               string    `json:"cluster"`
	RateLimitRPS          int       `json:"rate_limit_rps"`
	MaxConnections        int       `json:"max_connections"`
	MessageHistoryEnabled bool      `json:"message_history_enabled"`
	WebhooksEnabled       bool      `json:"webhooks_enabled"`
	CreatedAt             time.Time `json:"created_at"`
	UpdatedAt             time.Time `json:"updated_at"`
}

type APIKey struct {
	ID               string    `json:"id"`
	AppID            string    `json:"app_id"`
	Name             string    `json:"name"`
	Key              string    `json:"key"`
	Secret           string    `json:"secret,omitempty"`
	SecretCiphertext string    `json:"-"`
	Scopes           []string  `json:"scopes"` // "read", "trigger", "admin"
	CreatedAt        time.Time `json:"created_at"`
}

type BeamsInstance struct {
	InstanceID        string    `json:"instance_id"`
	AppID             string    `json:"app_id"`
	FCMServiceAccount string    `json:"-"` // plaintext decrypted
	FCMEncrypted      string    `json:"-"`
	APNsKey           string    `json:"-"` // plaintext decrypted
	APNsEncrypted     string    `json:"-"`
	APNsKeyID         string    `json:"apns_key_id"`
	APNsTeamID        string    `json:"apns_team_id"`
	APNsBundleID      string    `json:"apns_bundle_id"`
	APNsProduction    bool      `json:"apns_production"`
	HasFCM            bool      `json:"has_fcm"`
	HasAPNs           bool      `json:"has_apns"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
}

type Device struct {
	DeviceID   string          `json:"device_id"`
	InstanceID string          `json:"instance_id"`
	Platform   string          `json:"platform"` // "fcm" | "apns"
	Token      string          `json:"token"`
	UserID     *string         `json:"user_id,omitempty"`
	Interests  []string        `json:"interests"`
	Metadata   json.RawMessage `json:"metadata,omitempty"`
	CreatedAt  time.Time       `json:"created_at"`
	UpdatedAt  time.Time       `json:"updated_at"`
}

type ChannelMessage struct {
	ID          int64     `json:"id"`
	AppID       string    `json:"app_id"`
	ChannelName string    `json:"channel_name"`
	EventName   string    `json:"event_name"`
	Payload     string    `json:"payload"`
	SocketID    string    `json:"socket_id,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
}

type Webhook struct {
	ID               string    `json:"id"`
	AppID            string    `json:"app_id"`
	URL              string    `json:"url"`
	Events           []string  `json:"events"`
	Secret           string    `json:"secret,omitempty"`
	SecretCiphertext string    `json:"-"`
	Active           bool      `json:"active"`
	CreatedAt        time.Time `json:"created_at"`
}

type WebhookDelivery struct {
	ID           string          `json:"id"`
	WebhookID    string          `json:"webhook_id"`
	AppID        string          `json:"app_id"`
	Event        string          `json:"event"`
	Payload      json.RawMessage `json:"payload"`
	StatusCode   int             `json:"status_code"`
	ResponseBody string          `json:"response_body"`
	Attempt      int             `json:"attempt"`
	Status       string          `json:"status"` // "success", "failed", "retrying"
	Error        string          `json:"error,omitempty"`
	CreatedAt    time.Time       `json:"created_at"`
	UpdatedAt    time.Time       `json:"updated_at"`
}

type PushDelivery struct {
	ID          string    `json:"id"`
	InstanceID  string    `json:"instance_id"`
	PublishID   string    `json:"publish_id"`
	TargetType  string    `json:"target_type"` // "interest" | "user"
	Target      string    `json:"target"`
	Platform    string    `json:"platform"`
	SentCount   int       `json:"sent_count"`
	FailedCount int       `json:"failed_count"`
	Status      string    `json:"status"`
	CreatedAt   time.Time `json:"created_at"`
}

// Pusher REST Event Trigger structs
type EventTriggerRequest struct {
	Name     string          `json:"name"`
	Channels []string        `json:"channels,omitempty"`
	Channel  string          `json:"channel,omitempty"`
	Data     json.RawMessage `json:"data"`
	SocketID *string         `json:"socket_id,omitempty"`
	Info     string          `json:"info,omitempty"`
}

type BatchEventItem struct {
	Name     string          `json:"name"`
	Channel  string          `json:"channel"`
	Data     json.RawMessage `json:"data"`
	SocketID *string         `json:"socket_id,omitempty"`
	Info     string          `json:"info,omitempty"`
}

type BatchEventsRequest struct {
	Batch []BatchEventItem `json:"batch"`
}

// Unified Broadcast struct (WebSocket channel + Beams interest)
type UnifiedBroadcastRequest struct {
	Channel   string          `json:"channel"`
	EventName string          `json:"event_name"`
	Data      json.RawMessage `json:"data"`
	Interest  string          `json:"interest,omitempty"`
	PushTitle string          `json:"push_title,omitempty"`
	PushBody  string          `json:"push_body,omitempty"`
	SocketID  *string         `json:"socket_id,omitempty"`
}

package store

import (
	"context"
	"errors"

	"github.com/khajumsanjog/aps/internal/models"
)

var (
	ErrNotFound      = errors.New("store: record not found")
	ErrAlreadyExists = errors.New("store: record already exists")
)

type Store interface {
	// Users
	CreateUser(ctx context.Context, user *models.User) error
	GetUserByEmail(ctx context.Context, email string) (*models.User, error)
	GetUserByID(ctx context.Context, id string) (*models.User, error)

	// Apps
	CreateApp(ctx context.Context, app *models.App) error
	GetAppByID(ctx context.Context, id string) (*models.App, error)
	GetAppByKey(ctx context.Context, key string) (*models.App, error)
	ListAppsByOwner(ctx context.Context, ownerID string) ([]*models.App, error)
	UpdateApp(ctx context.Context, app *models.App) error
	DeleteApp(ctx context.Context, id string) error

	// API Keys
	CreateAPIKey(ctx context.Context, key *models.APIKey) error
	GetAPIKey(ctx context.Context, keyStr string) (*models.APIKey, error)
	ListAPIKeysByApp(ctx context.Context, appID string) ([]*models.APIKey, error)
	DeleteAPIKey(ctx context.Context, id string) error

	// Beams Instances
	CreateBeamsInstance(ctx context.Context, instance *models.BeamsInstance) error
	GetBeamsInstanceByID(ctx context.Context, id string) (*models.BeamsInstance, error)
	GetBeamsInstanceByAppID(ctx context.Context, appID string) (*models.BeamsInstance, error)
	UpdateBeamsCredentials(ctx context.Context, instance *models.BeamsInstance) error

	// Devices
	UpsertDevice(ctx context.Context, device *models.Device) error
	GetDevice(ctx context.Context, deviceID string) (*models.Device, error)
	ListDevicesByInstance(ctx context.Context, instanceID string, limit int) ([]*models.Device, error)
	ListDevicesByInterests(ctx context.Context, instanceID string, interests []string) ([]*models.Device, error)
	ListDevicesByUser(ctx context.Context, instanceID, userID string) ([]*models.Device, error)
	DeleteDevice(ctx context.Context, deviceID string) error
	DeleteDevicesByUser(ctx context.Context, instanceID, userID string) error

	// Channel History
	SaveChannelMessage(ctx context.Context, msg *models.ChannelMessage) error
	GetChannelHistory(ctx context.Context, appID, channelName string, limit int) ([]*models.ChannelMessage, error)

	// Webhooks
	CreateWebhook(ctx context.Context, webhook *models.Webhook) error
	ListWebhooksByApp(ctx context.Context, appID string) ([]*models.Webhook, error)
	DeleteWebhook(ctx context.Context, id string) error
	SaveWebhookDelivery(ctx context.Context, delivery *models.WebhookDelivery) error
	ListWebhookDeliveries(ctx context.Context, appID string, limit int) ([]*models.WebhookDelivery, error)

	// Push Deliveries
	SavePushDelivery(ctx context.Context, delivery *models.PushDelivery) error
	ListPushDeliveries(ctx context.Context, instanceID string, limit int) ([]*models.PushDelivery, error)
}

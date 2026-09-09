package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/khajumsanjog/aps/internal/models"
)

type PostgresStore struct {
	pool *pgxpool.Pool
}

func NewPostgresStore(ctx context.Context, databaseURL string) (*PostgresStore, error) {
	cfg, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, fmt.Errorf("failed to parse database url: %w", err)
	}

	cfg.MaxConns = 30
	cfg.MinConns = 5
	cfg.MaxConnLifetime = 1 * time.Hour
	cfg.MaxConnIdleTime = 30 * time.Minute

	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to postgres: %w", err)
	}

	if err := pool.Ping(ctx); err != nil {
		return nil, fmt.Errorf("failed to ping postgres: %w", err)
	}

	return &PostgresStore{pool: pool}, nil
}

func (s *PostgresStore) Close() {
	if s.pool != nil {
		s.pool.Close()
	}
}

// Users
func (s *PostgresStore) CreateUser(ctx context.Context, user *models.User) error {
	query := `
		INSERT INTO users (id, email, password_hash, role, created_at, updated_at)
		VALUES ($1, $2, $3, $4, NOW(), NOW())
		RETURNING created_at, updated_at;
	`
	err := s.pool.QueryRow(ctx, query, user.ID, user.Email, user.PasswordHash, user.Role).
		Scan(&user.CreatedAt, &user.UpdatedAt)
	if err != nil {
		return err
	}
	return nil
}

func (s *PostgresStore) GetUserByEmail(ctx context.Context, email string) (*models.User, error) {
	query := `SELECT id, email, password_hash, role, created_at, updated_at FROM users WHERE email = $1;`
	var u models.User
	err := s.pool.QueryRow(ctx, query, email).
		Scan(&u.ID, &u.Email, &u.PasswordHash, &u.Role, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &u, nil
}

func (s *PostgresStore) GetUserByID(ctx context.Context, id string) (*models.User, error) {
	query := `SELECT id, email, password_hash, role, created_at, updated_at FROM users WHERE id = $1;`
	var u models.User
	err := s.pool.QueryRow(ctx, query, id).
		Scan(&u.ID, &u.Email, &u.PasswordHash, &u.Role, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &u, nil
}

// Apps
func (s *PostgresStore) CreateApp(ctx context.Context, app *models.App) error {
	query := `
		INSERT INTO apps (id, name, app_key, secret_ciphertext, owner_id, cluster, rate_limit_rps, max_connections, message_history_enabled, webhooks_enabled, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
		RETURNING created_at, updated_at;
	`
	err := s.pool.QueryRow(ctx, query,
		app.ID, app.Name, app.AppKey, app.SecretCiphertext, app.OwnerID, app.Cluster,
		app.RateLimitRPS, app.MaxConnections, app.MessageHistoryEnabled, app.WebhooksEnabled,
	).Scan(&app.CreatedAt, &app.UpdatedAt)
	if err != nil {
		return err
	}
	return nil
}

func (s *PostgresStore) GetAppByID(ctx context.Context, id string) (*models.App, error) {
	query := `
		SELECT id, name, app_key, secret_ciphertext, owner_id, cluster, rate_limit_rps, max_connections, message_history_enabled, webhooks_enabled, created_at, updated_at
		FROM apps WHERE id = $1;
	`
	var a models.App
	err := s.pool.QueryRow(ctx, query, id).
		Scan(&a.ID, &a.Name, &a.AppKey, &a.SecretCiphertext, &a.OwnerID, &a.Cluster,
			&a.RateLimitRPS, &a.MaxConnections, &a.MessageHistoryEnabled, &a.WebhooksEnabled,
			&a.CreatedAt, &a.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &a, nil
}

func (s *PostgresStore) GetAppByKey(ctx context.Context, key string) (*models.App, error) {
	query := `
		SELECT id, name, app_key, secret_ciphertext, owner_id, cluster, rate_limit_rps, max_connections, message_history_enabled, webhooks_enabled, created_at, updated_at
		FROM apps WHERE app_key = $1;
	`
	var a models.App
	err := s.pool.QueryRow(ctx, query, key).
		Scan(&a.ID, &a.Name, &a.AppKey, &a.SecretCiphertext, &a.OwnerID, &a.Cluster,
			&a.RateLimitRPS, &a.MaxConnections, &a.MessageHistoryEnabled, &a.WebhooksEnabled,
			&a.CreatedAt, &a.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &a, nil
}

func (s *PostgresStore) ListAppsByOwner(ctx context.Context, ownerID string) ([]*models.App, error) {
	query := `
		SELECT id, name, app_key, secret_ciphertext, owner_id, cluster, rate_limit_rps, max_connections, message_history_enabled, webhooks_enabled, created_at, updated_at
		FROM apps WHERE owner_id = $1 ORDER BY created_at DESC;
	`
	rows, err := s.pool.Query(ctx, query, ownerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var apps []*models.App
	for rows.Next() {
		var a models.App
		err := rows.Scan(&a.ID, &a.Name, &a.AppKey, &a.SecretCiphertext, &a.OwnerID, &a.Cluster,
			&a.RateLimitRPS, &a.MaxConnections, &a.MessageHistoryEnabled, &a.WebhooksEnabled,
			&a.CreatedAt, &a.UpdatedAt)
		if err != nil {
			return nil, err
		}
		apps = append(apps, &a)
	}
	return apps, nil
}

func (s *PostgresStore) UpdateApp(ctx context.Context, app *models.App) error {
	query := `
		UPDATE apps
		SET name = $2, cluster = $3, rate_limit_rps = $4, max_connections = $5,
		    message_history_enabled = $6, webhooks_enabled = $7, updated_at = NOW()
		WHERE id = $1;
	`
	_, err := s.pool.Exec(ctx, query, app.ID, app.Name, app.Cluster, app.RateLimitRPS,
		app.MaxConnections, app.MessageHistoryEnabled, app.WebhooksEnabled)
	return err
}

func (s *PostgresStore) DeleteApp(ctx context.Context, id string) error {
	query := `DELETE FROM apps WHERE id = $1;`
	_, err := s.pool.Exec(ctx, query, id)
	return err
}

// API Keys
func (s *PostgresStore) CreateAPIKey(ctx context.Context, key *models.APIKey) error {
	query := `
		INSERT INTO api_keys (id, app_id, name, key, secret_ciphertext, scopes, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, NOW())
		RETURNING created_at;
	`
	return s.pool.QueryRow(ctx, query, key.ID, key.AppID, key.Name, key.Key, key.SecretCiphertext, key.Scopes).
		Scan(&key.CreatedAt)
}

func (s *PostgresStore) GetAPIKey(ctx context.Context, keyStr string) (*models.APIKey, error) {
	query := `SELECT id, app_id, name, key, secret_ciphertext, scopes, created_at FROM api_keys WHERE key = $1;`
	var k models.APIKey
	err := s.pool.QueryRow(ctx, query, keyStr).
		Scan(&k.ID, &k.AppID, &k.Name, &k.Key, &k.SecretCiphertext, &k.Scopes, &k.CreatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &k, nil
}

func (s *PostgresStore) ListAPIKeysByApp(ctx context.Context, appID string) ([]*models.APIKey, error) {
	query := `SELECT id, app_id, name, key, secret_ciphertext, scopes, created_at FROM api_keys WHERE app_id = $1 ORDER BY created_at DESC;`
	rows, err := s.pool.Query(ctx, query, appID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var keys []*models.APIKey
	for rows.Next() {
		var k models.APIKey
		if err := rows.Scan(&k.ID, &k.AppID, &k.Name, &k.Key, &k.SecretCiphertext, &k.Scopes, &k.CreatedAt); err != nil {
			return nil, err
		}
		keys = append(keys, &k)
	}
	return keys, nil
}

func (s *PostgresStore) DeleteAPIKey(ctx context.Context, id string) error {
	query := `DELETE FROM api_keys WHERE id = $1;`
	_, err := s.pool.Exec(ctx, query, id)
	return err
}

// Beams Instances
func (s *PostgresStore) CreateBeamsInstance(ctx context.Context, instance *models.BeamsInstance) error {
	query := `
		INSERT INTO beams_instances (instance_id, app_id, fcm_service_account, apns_key, apns_key_id, apns_team_id, apns_bundle_id, apns_production, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
		RETURNING created_at, updated_at;
	`
	return s.pool.QueryRow(ctx, query,
		instance.InstanceID, instance.AppID, instance.FCMEncrypted, instance.APNsEncrypted,
		instance.APNsKeyID, instance.APNsTeamID, instance.APNsBundleID, instance.APNsProduction,
	).Scan(&instance.CreatedAt, &instance.UpdatedAt)
}

func (s *PostgresStore) GetBeamsInstanceByID(ctx context.Context, id string) (*models.BeamsInstance, error) {
	query := `
		SELECT instance_id, app_id, COALESCE(fcm_service_account, ''), COALESCE(apns_key, ''), COALESCE(apns_key_id, ''), COALESCE(apns_team_id, ''), COALESCE(apns_bundle_id, ''), apns_production, created_at, updated_at
		FROM beams_instances WHERE instance_id = $1;
	`
	var bi models.BeamsInstance
	err := s.pool.QueryRow(ctx, query, id).
		Scan(&bi.InstanceID, &bi.AppID, &bi.FCMEncrypted, &bi.APNsEncrypted,
			&bi.APNsKeyID, &bi.APNsTeamID, &bi.APNsBundleID, &bi.APNsProduction,
			&bi.CreatedAt, &bi.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	bi.HasFCM = bi.FCMEncrypted != ""
	bi.HasAPNs = bi.APNsEncrypted != ""
	return &bi, nil
}

func (s *PostgresStore) GetBeamsInstanceByAppID(ctx context.Context, appID string) (*models.BeamsInstance, error) {
	query := `
		SELECT instance_id, app_id, COALESCE(fcm_service_account, ''), COALESCE(apns_key, ''), COALESCE(apns_key_id, ''), COALESCE(apns_team_id, ''), COALESCE(apns_bundle_id, ''), apns_production, created_at, updated_at
		FROM beams_instances WHERE app_id = $1;
	`
	var bi models.BeamsInstance
	err := s.pool.QueryRow(ctx, query, appID).
		Scan(&bi.InstanceID, &bi.AppID, &bi.FCMEncrypted, &bi.APNsEncrypted,
			&bi.APNsKeyID, &bi.APNsTeamID, &bi.APNsBundleID, &bi.APNsProduction,
			&bi.CreatedAt, &bi.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	bi.HasFCM = bi.FCMEncrypted != ""
	bi.HasAPNs = bi.APNsEncrypted != ""
	return &bi, nil
}

func (s *PostgresStore) UpdateBeamsCredentials(ctx context.Context, instance *models.BeamsInstance) error {
	query := `
		UPDATE beams_instances
		SET fcm_service_account = $2, apns_key = $3, apns_key_id = $4, apns_team_id = $5,
		    apns_bundle_id = $6, apns_production = $7, updated_at = NOW()
		WHERE instance_id = $1;
	`
	_, err := s.pool.Exec(ctx, query,
		instance.InstanceID, instance.FCMEncrypted, instance.APNsEncrypted,
		instance.APNsKeyID, instance.APNsTeamID, instance.APNsBundleID, instance.APNsProduction)
	return err
}

// Devices
func (s *PostgresStore) UpsertDevice(ctx context.Context, device *models.Device) error {
	metaJSON, _ := json.Marshal(device.Metadata)
	if len(device.Metadata) == 0 {
		metaJSON = []byte("{}")
	}

	query := `
		INSERT INTO devices (device_id, instance_id, platform, token, user_id, interests, metadata, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
		ON CONFLICT (device_id) DO UPDATE
		SET token = EXCLUDED.token,
		    user_id = EXCLUDED.user_id,
		    interests = EXCLUDED.interests,
		    metadata = EXCLUDED.metadata,
		    updated_at = NOW()
		RETURNING created_at, updated_at;
	`
	return s.pool.QueryRow(ctx, query,
		device.DeviceID, device.InstanceID, device.Platform, device.Token,
		device.UserID, device.Interests, metaJSON,
	).Scan(&device.CreatedAt, &device.UpdatedAt)
}

func (s *PostgresStore) GetDevice(ctx context.Context, deviceID string) (*models.Device, error) {
	query := `
		SELECT device_id, instance_id, platform, token, user_id, interests, metadata, created_at, updated_at
		FROM devices WHERE device_id = $1;
	`
	var d models.Device
	var metaBytes []byte
	err := s.pool.QueryRow(ctx, query, deviceID).
		Scan(&d.DeviceID, &d.InstanceID, &d.Platform, &d.Token, &d.UserID, &d.Interests, &metaBytes, &d.CreatedAt, &d.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	d.Metadata = metaBytes
	return &d, nil
}

func (s *PostgresStore) ListDevicesByInstance(ctx context.Context, instanceID string, limit int) ([]*models.Device, error) {
	if limit <= 0 {
		limit = 100
	}
	query := `
		SELECT device_id, instance_id, platform, token, user_id, interests, metadata, created_at, updated_at
		FROM devices WHERE instance_id = $1 ORDER BY updated_at DESC LIMIT $2;
	`
	rows, err := s.pool.Query(ctx, query, instanceID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	devices := make([]*models.Device, 0)
	for rows.Next() {
		var d models.Device
		var metaBytes []byte
		if err := rows.Scan(&d.DeviceID, &d.InstanceID, &d.Platform, &d.Token, &d.UserID, &d.Interests, &metaBytes, &d.CreatedAt, &d.UpdatedAt); err != nil {
			return nil, err
		}
		d.Metadata = metaBytes
		devices = append(devices, &d)
	}
	return devices, nil
}

func (s *PostgresStore) ListDevicesByInterests(ctx context.Context, instanceID string, interests []string) ([]*models.Device, error) {
	query := `
		SELECT device_id, instance_id, platform, token, user_id, interests, metadata, created_at, updated_at
		FROM devices WHERE instance_id = $1 AND interests && $2;
	`
	rows, err := s.pool.Query(ctx, query, instanceID, interests)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	devices := make([]*models.Device, 0)
	for rows.Next() {
		var d models.Device
		var metaBytes []byte
		if err := rows.Scan(&d.DeviceID, &d.InstanceID, &d.Platform, &d.Token, &d.UserID, &d.Interests, &metaBytes, &d.CreatedAt, &d.UpdatedAt); err != nil {
			return nil, err
		}
		d.Metadata = metaBytes
		devices = append(devices, &d)
	}
	return devices, nil
}

func (s *PostgresStore) ListDevicesByUser(ctx context.Context, instanceID, userID string) ([]*models.Device, error) {
	query := `
		SELECT device_id, instance_id, platform, token, user_id, interests, metadata, created_at, updated_at
		FROM devices WHERE instance_id = $1 AND user_id = $2;
	`
	rows, err := s.pool.Query(ctx, query, instanceID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var devices []*models.Device
	for rows.Next() {
		var d models.Device
		var metaBytes []byte
		if err := rows.Scan(&d.DeviceID, &d.InstanceID, &d.Platform, &d.Token, &d.UserID, &d.Interests, &metaBytes, &d.CreatedAt, &d.UpdatedAt); err != nil {
			return nil, err
		}
		d.Metadata = metaBytes
		devices = append(devices, &d)
	}
	return devices, nil
}

func (s *PostgresStore) DeleteDevice(ctx context.Context, deviceID string) error {
	query := `DELETE FROM devices WHERE device_id = $1;`
	_, err := s.pool.Exec(ctx, query, deviceID)
	return err
}

func (s *PostgresStore) DeleteDevicesByUser(ctx context.Context, instanceID, userID string) error {
	query := `DELETE FROM devices WHERE instance_id = $1 AND user_id = $2;`
	_, err := s.pool.Exec(ctx, query, instanceID, userID)
	return err
}

// Channel History
func (s *PostgresStore) SaveChannelMessage(ctx context.Context, msg *models.ChannelMessage) error {
	query := `
		INSERT INTO channel_history (app_id, channel_name, event_name, payload, socket_id, created_at)
		VALUES ($1, $2, $3, $4, $5, NOW())
		RETURNING id, created_at;
	`
	return s.pool.QueryRow(ctx, query, msg.AppID, msg.ChannelName, msg.EventName, msg.Payload, msg.SocketID).
		Scan(&msg.ID, &msg.CreatedAt)
}

func (s *PostgresStore) GetChannelHistory(ctx context.Context, appID, channelName string, limit int) ([]*models.ChannelMessage, error) {
	if limit <= 0 {
		limit = 50
	}
	query := `
		SELECT id, app_id, channel_name, event_name, payload, COALESCE(socket_id, ''), created_at
		FROM channel_history
		WHERE app_id = $1 AND channel_name = $2
		ORDER BY created_at DESC
		LIMIT $3;
	`
	rows, err := s.pool.Query(ctx, query, appID, channelName, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	msgs := make([]*models.ChannelMessage, 0)
	for rows.Next() {
		var m models.ChannelMessage
		if err := rows.Scan(&m.ID, &m.AppID, &m.ChannelName, &m.EventName, &m.Payload, &m.SocketID, &m.CreatedAt); err != nil {
			return nil, err
		}
		msgs = append(msgs, &m)
	}

	// Return chronological order (oldest to newest)
	for i, j := 0, len(msgs)-1; i < j; i, j = i+1, j-1 {
		msgs[i], msgs[j] = msgs[j], msgs[i]
	}
	return msgs, nil
}

// Webhooks
func (s *PostgresStore) CreateWebhook(ctx context.Context, webhook *models.Webhook) error {
	query := `
		INSERT INTO webhooks (id, app_id, url, events, secret_ciphertext, active, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, NOW())
		RETURNING created_at;
	`
	return s.pool.QueryRow(ctx, query,
		webhook.ID, webhook.AppID, webhook.URL, webhook.Events, webhook.SecretCiphertext, webhook.Active,
	).Scan(&webhook.CreatedAt)
}

func (s *PostgresStore) ListWebhooksByApp(ctx context.Context, appID string) ([]*models.Webhook, error) {
	query := `
		SELECT id, app_id, url, events, secret_ciphertext, active, created_at
		FROM webhooks WHERE app_id = $1;
	`
	rows, err := s.pool.Query(ctx, query, appID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]*models.Webhook, 0)
	for rows.Next() {
		var w models.Webhook
		if err := rows.Scan(&w.ID, &w.AppID, &w.URL, &w.Events, &w.SecretCiphertext, &w.Active, &w.CreatedAt); err != nil {
			return nil, err
		}
		list = append(list, &w)
	}
	return list, nil
}

func (s *PostgresStore) DeleteWebhook(ctx context.Context, id string) error {
	query := `DELETE FROM webhooks WHERE id = $1;`
	_, err := s.pool.Exec(ctx, query, id)
	return err
}

func (s *PostgresStore) SaveWebhookDelivery(ctx context.Context, delivery *models.WebhookDelivery) error {
	payloadJSON, _ := json.Marshal(delivery.Payload)
	query := `
		INSERT INTO webhook_deliveries (id, webhook_id, app_id, event, payload, status_code, response_body, attempt, status, error, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
		RETURNING created_at, updated_at;
	`
	return s.pool.QueryRow(ctx, query,
		delivery.ID, delivery.WebhookID, delivery.AppID, delivery.Event, payloadJSON,
		delivery.StatusCode, delivery.ResponseBody, delivery.Attempt, delivery.Status, delivery.Error,
	).Scan(&delivery.CreatedAt, &delivery.UpdatedAt)
}

func (s *PostgresStore) ListWebhookDeliveries(ctx context.Context, appID string, limit int) ([]*models.WebhookDelivery, error) {
	if limit <= 0 {
		limit = 50
	}
	query := `
		SELECT id, webhook_id, app_id, event, payload, status_code, COALESCE(response_body, ''), attempt, status, COALESCE(error, ''), created_at, updated_at
		FROM webhook_deliveries
		WHERE app_id = $1
		ORDER BY created_at DESC
		LIMIT $2;
	`
	rows, err := s.pool.Query(ctx, query, appID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	deliveries := make([]*models.WebhookDelivery, 0)
	for rows.Next() {
		var d models.WebhookDelivery
		var payloadBytes []byte
		if err := rows.Scan(&d.ID, &d.WebhookID, &d.AppID, &d.Event, &payloadBytes,
			&d.StatusCode, &d.ResponseBody, &d.Attempt, &d.Status, &d.Error,
			&d.CreatedAt, &d.UpdatedAt); err != nil {
			return nil, err
		}
		d.Payload = payloadBytes
		deliveries = append(deliveries, &d)
	}
	return deliveries, nil
}

// Push Deliveries
func (s *PostgresStore) SavePushDelivery(ctx context.Context, delivery *models.PushDelivery) error {
	query := `
		INSERT INTO push_deliveries (id, instance_id, publish_id, target_type, target, platform, sent_count, failed_count, status, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
		RETURNING created_at;
	`
	return s.pool.QueryRow(ctx, query,
		delivery.ID, delivery.InstanceID, delivery.PublishID, delivery.TargetType, delivery.Target,
		delivery.Platform, delivery.SentCount, delivery.FailedCount, delivery.Status,
	).Scan(&delivery.CreatedAt)
}

func (s *PostgresStore) ListPushDeliveries(ctx context.Context, instanceID string, limit int) ([]*models.PushDelivery, error) {
	if limit <= 0 {
		limit = 50
	}
	query := `
		SELECT id, instance_id, publish_id, target_type, target, platform, sent_count, failed_count, status, created_at
		FROM push_deliveries
		WHERE instance_id = $1
		ORDER BY created_at DESC
		LIMIT $2;
	`
	rows, err := s.pool.Query(ctx, query, instanceID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	deliveries := make([]*models.PushDelivery, 0)
	for rows.Next() {
		var d models.PushDelivery
		if err := rows.Scan(&d.ID, &d.InstanceID, &d.PublishID, &d.TargetType, &d.Target,
			&d.Platform, &d.SentCount, &d.FailedCount, &d.Status, &d.CreatedAt); err != nil {
			return nil, err
		}
		deliveries = append(deliveries, &d)
	}
	return deliveries, nil
}

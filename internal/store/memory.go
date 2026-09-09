package store

import (
	"context"
	"slices"
	"sync"
	"time"

	"github.com/khajumsanjog/aps/internal/models"
)

type MemoryStore struct {
	mu                sync.RWMutex
	users             map[string]*models.User
	usersByEmail      map[string]*models.User
	apps              map[string]*models.App
	appsByKey         map[string]*models.App
	apiKeys           map[string]*models.APIKey
	apiKeysByKey      map[string]*models.APIKey
	beamsInstances    map[string]*models.BeamsInstance
	beamsByApp        map[string]*models.BeamsInstance
	devices           map[string]*models.Device
	channelHistory    map[string][]*models.ChannelMessage // key: appID:channelName
	historySeq        int64
	webhooks          map[string]*models.Webhook
	webhookDeliveries map[string][]*models.WebhookDelivery // key: appID
	pushDeliveries    map[string][]*models.PushDelivery    // key: instanceID
}

func NewMemoryStore() *MemoryStore {
	return &MemoryStore{
		users:             make(map[string]*models.User),
		usersByEmail:      make(map[string]*models.User),
		apps:              make(map[string]*models.App),
		appsByKey:         make(map[string]*models.App),
		apiKeys:           make(map[string]*models.APIKey),
		apiKeysByKey:      make(map[string]*models.APIKey),
		beamsInstances:    make(map[string]*models.BeamsInstance),
		beamsByApp:        make(map[string]*models.BeamsInstance),
		devices:           make(map[string]*models.Device),
		channelHistory:    make(map[string][]*models.ChannelMessage),
		webhooks:          make(map[string]*models.Webhook),
		webhookDeliveries: make(map[string][]*models.WebhookDelivery),
		pushDeliveries:    make(map[string][]*models.PushDelivery),
	}
}

// Users
func (s *MemoryStore) CreateUser(ctx context.Context, user *models.User) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, exists := s.usersByEmail[user.Email]; exists {
		return ErrAlreadyExists
	}
	user.CreatedAt = time.Now()
	user.UpdatedAt = time.Now()
	s.users[user.ID] = user
	s.usersByEmail[user.Email] = user
	return nil
}

func (s *MemoryStore) GetUserByEmail(ctx context.Context, email string) (*models.User, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	u, exists := s.usersByEmail[email]
	if !exists {
		return nil, ErrNotFound
	}
	return u, nil
}

func (s *MemoryStore) GetUserByID(ctx context.Context, id string) (*models.User, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	u, exists := s.users[id]
	if !exists {
		return nil, ErrNotFound
	}
	return u, nil
}

// Apps
func (s *MemoryStore) CreateApp(ctx context.Context, app *models.App) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, exists := s.apps[app.ID]; exists {
		return ErrAlreadyExists
	}
	if _, exists := s.appsByKey[app.AppKey]; exists {
		return ErrAlreadyExists
	}
	app.CreatedAt = time.Now()
	app.UpdatedAt = time.Now()
	s.apps[app.ID] = app
	s.appsByKey[app.AppKey] = app
	return nil
}

func (s *MemoryStore) GetAppByID(ctx context.Context, id string) (*models.App, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	app, exists := s.apps[id]
	if !exists {
		return nil, ErrNotFound
	}
	return app, nil
}

func (s *MemoryStore) GetAppByKey(ctx context.Context, key string) (*models.App, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	app, exists := s.appsByKey[key]
	if !exists {
		return nil, ErrNotFound
	}
	return app, nil
}

func (s *MemoryStore) ListAppsByOwner(ctx context.Context, ownerID string) ([]*models.App, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	res := make([]*models.App, 0)
	for _, app := range s.apps {
		if app.OwnerID == ownerID {
			res = append(res, app)
		}
	}
	return res, nil
}

func (s *MemoryStore) UpdateApp(ctx context.Context, app *models.App) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	existing, exists := s.apps[app.ID]
	if !exists {
		return ErrNotFound
	}
	app.UpdatedAt = time.Now()
	app.CreatedAt = existing.CreatedAt
	s.apps[app.ID] = app
	s.appsByKey[app.AppKey] = app
	return nil
}

func (s *MemoryStore) DeleteApp(ctx context.Context, id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	app, exists := s.apps[id]
	if !exists {
		return ErrNotFound
	}
	delete(s.appsByKey, app.AppKey)
	delete(s.apps, id)
	return nil
}

// API Keys
func (s *MemoryStore) CreateAPIKey(ctx context.Context, key *models.APIKey) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	key.CreatedAt = time.Now()
	s.apiKeys[key.ID] = key
	s.apiKeysByKey[key.Key] = key
	return nil
}

func (s *MemoryStore) GetAPIKey(ctx context.Context, keyStr string) (*models.APIKey, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	k, exists := s.apiKeysByKey[keyStr]
	if !exists {
		return nil, ErrNotFound
	}
	return k, nil
}

func (s *MemoryStore) ListAPIKeysByApp(ctx context.Context, appID string) ([]*models.APIKey, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var res []*models.APIKey
	for _, k := range s.apiKeys {
		if k.AppID == appID {
			res = append(res, k)
		}
	}
	return res, nil
}

func (s *MemoryStore) DeleteAPIKey(ctx context.Context, id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	k, exists := s.apiKeys[id]
	if !exists {
		return ErrNotFound
	}
	delete(s.apiKeysByKey, k.Key)
	delete(s.apiKeys, id)
	return nil
}

// Beams Instances
func (s *MemoryStore) CreateBeamsInstance(ctx context.Context, instance *models.BeamsInstance) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	instance.CreatedAt = time.Now()
	instance.UpdatedAt = time.Now()
	s.beamsInstances[instance.InstanceID] = instance
	s.beamsByApp[instance.AppID] = instance
	return nil
}

func (s *MemoryStore) GetBeamsInstanceByID(ctx context.Context, id string) (*models.BeamsInstance, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	bi, exists := s.beamsInstances[id]
	if !exists {
		return nil, ErrNotFound
	}
	return bi, nil
}

func (s *MemoryStore) GetBeamsInstanceByAppID(ctx context.Context, appID string) (*models.BeamsInstance, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	bi, exists := s.beamsByApp[appID]
	if !exists {
		return nil, ErrNotFound
	}
	return bi, nil
}

func (s *MemoryStore) UpdateBeamsCredentials(ctx context.Context, instance *models.BeamsInstance) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	existing, exists := s.beamsInstances[instance.InstanceID]
	if !exists {
		return ErrNotFound
	}
	instance.UpdatedAt = time.Now()
	instance.CreatedAt = existing.CreatedAt
	s.beamsInstances[instance.InstanceID] = instance
	s.beamsByApp[instance.AppID] = instance
	return nil
}

// Devices
func (s *MemoryStore) UpsertDevice(ctx context.Context, device *models.Device) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if existing, exists := s.devices[device.DeviceID]; exists {
		device.CreatedAt = existing.CreatedAt
	} else {
		device.CreatedAt = time.Now()
	}
	device.UpdatedAt = time.Now()
	s.devices[device.DeviceID] = device
	return nil
}

func (s *MemoryStore) GetDevice(ctx context.Context, deviceID string) (*models.Device, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	d, exists := s.devices[deviceID]
	if !exists {
		return nil, ErrNotFound
	}
	return d, nil
}

func (s *MemoryStore) ListDevicesByInstance(ctx context.Context, instanceID string, limit int) ([]*models.Device, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	res := make([]*models.Device, 0)
	for _, d := range s.devices {
		if d.InstanceID == instanceID {
			res = append(res, d)
			if limit > 0 && len(res) >= limit {
				break
			}
		}
	}
	return res, nil
}

func (s *MemoryStore) ListDevicesByInterests(ctx context.Context, instanceID string, interests []string) ([]*models.Device, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	res := make([]*models.Device, 0)
	for _, d := range s.devices {
		if d.InstanceID != instanceID {
			continue
		}
		for _, targetInterest := range interests {
			if slices.Contains(d.Interests, targetInterest) {
				res = append(res, d)
				break
			}
		}
	}
	return res, nil
}

func (s *MemoryStore) ListDevicesByUser(ctx context.Context, instanceID, userID string) ([]*models.Device, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var res []*models.Device
	for _, d := range s.devices {
		if d.InstanceID == instanceID && d.UserID != nil && *d.UserID == userID {
			res = append(res, d)
		}
	}
	return res, nil
}

func (s *MemoryStore) DeleteDevice(ctx context.Context, deviceID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	delete(s.devices, deviceID)
	return nil
}

func (s *MemoryStore) DeleteDevicesByUser(ctx context.Context, instanceID, userID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	for id, d := range s.devices {
		if d.InstanceID == instanceID && d.UserID != nil && *d.UserID == userID {
			delete(s.devices, id)
		}
	}
	return nil
}

// Channel History
func (s *MemoryStore) SaveChannelMessage(ctx context.Context, msg *models.ChannelMessage) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.historySeq++
	msg.ID = s.historySeq
	msg.CreatedAt = time.Now()

	key := msg.AppID + ":" + msg.ChannelName
	list := s.channelHistory[key]
	// retain latest 1000 messages in memory per channel
	if len(list) >= 1000 {
		list = list[1:]
	}
	list = append(list, msg)
	s.channelHistory[key] = list
	return nil
}

func (s *MemoryStore) GetChannelHistory(ctx context.Context, appID, channelName string, limit int) ([]*models.ChannelMessage, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	key := appID + ":" + channelName
	list := s.channelHistory[key]
	if limit <= 0 || limit > len(list) {
		limit = len(list)
	}

	result := make([]*models.ChannelMessage, limit)
	start := len(list) - limit
	copy(result, list[start:])
	return result, nil
}

// Webhooks
func (s *MemoryStore) CreateWebhook(ctx context.Context, webhook *models.Webhook) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	webhook.CreatedAt = time.Now()
	s.webhooks[webhook.ID] = webhook
	return nil
}

func (s *MemoryStore) ListWebhooksByApp(ctx context.Context, appID string) ([]*models.Webhook, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	res := make([]*models.Webhook, 0)
	for _, w := range s.webhooks {
		if w.AppID == appID {
			res = append(res, w)
		}
	}
	return res, nil
}

func (s *MemoryStore) DeleteWebhook(ctx context.Context, id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	delete(s.webhooks, id)
	return nil
}

func (s *MemoryStore) SaveWebhookDelivery(ctx context.Context, delivery *models.WebhookDelivery) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	delivery.CreatedAt = time.Now()
	delivery.UpdatedAt = time.Now()

	list := s.webhookDeliveries[delivery.AppID]
	if len(list) >= 500 {
		list = list[1:]
	}
	list = append(list, delivery)
	s.webhookDeliveries[delivery.AppID] = list
	return nil
}

func (s *MemoryStore) ListWebhookDeliveries(ctx context.Context, appID string, limit int) ([]*models.WebhookDelivery, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	list := s.webhookDeliveries[appID]
	if limit <= 0 || limit > len(list) {
		limit = len(list)
	}

	result := make([]*models.WebhookDelivery, limit)
	start := len(list) - limit
	copy(result, list[start:])
	return result, nil
}

// Push Deliveries
func (s *MemoryStore) SavePushDelivery(ctx context.Context, delivery *models.PushDelivery) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	delivery.CreatedAt = time.Now()
	list := s.pushDeliveries[delivery.InstanceID]
	if len(list) >= 500 {
		list = list[1:]
	}
	list = append(list, delivery)
	s.pushDeliveries[delivery.InstanceID] = list
	return nil
}

func (s *MemoryStore) ListPushDeliveries(ctx context.Context, instanceID string, limit int) ([]*models.PushDelivery, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	list := s.pushDeliveries[instanceID]
	if limit <= 0 || limit > len(list) {
		limit = len(list)
	}

	result := make([]*models.PushDelivery, limit)
	start := len(list) - limit
	copy(result, list[start:])
	return result, nil
}

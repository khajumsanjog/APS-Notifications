package config

import (
	"strings"
	"time"

	"github.com/spf13/viper"
)

type Config struct {
	Env                   string        `mapstructure:"env"`
	Cluster               string        `mapstructure:"cluster"`
	Port                  int           `mapstructure:"port"`
	WSPort                int           `mapstructure:"ws_port"`
	APIPort               int           `mapstructure:"api_port"`
	BeamsPort             int           `mapstructure:"beams_port"`
	RedisURL              string        `mapstructure:"redis_url"`
	DatabaseURL           string        `mapstructure:"database_url"`
	MasterKey             string        `mapstructure:"master_key"`
	JWTSecret             string        `mapstructure:"jwt_secret"`
	JWTAccessExpiry       time.Duration `mapstructure:"jwt_access_expiry"`
	JWTRefreshExpiry      time.Duration `mapstructure:"jwt_refresh_expiry"`
	ActivityTimeout       time.Duration `mapstructure:"activity_timeout"`
	PingInterval          time.Duration `mapstructure:"ping_interval"`
	MaxConnectionsPerApp  int           `mapstructure:"max_connections_per_app"`
	RateLimitRPS          int           `mapstructure:"rate_limit_rps"`
	WebhookTimeout        time.Duration `mapstructure:"webhook_timeout"`
	WebhookMaxRetries     int           `mapstructure:"webhook_max_retries"`
	AllowMockPush         bool          `mapstructure:"allow_mock_push"`
}

func Load() (*Config, error) {
	v := viper.New()

	v.SetDefault("env", "development")
	v.SetDefault("cluster", "mt1")
	v.SetDefault("port", 8080)
	v.SetDefault("ws_port", 6001)
	v.SetDefault("api_port", 8080)
	v.SetDefault("beams_port", 8082)
	v.SetDefault("redis_url", "redis://localhost:6379/0")
	v.SetDefault("database_url", "")
	v.SetDefault("master_key", "aps-default-insecure-master-key-32b!")
	v.SetDefault("jwt_secret", "aps-default-insecure-jwt-secret-key-32b!")
	v.SetDefault("jwt_access_expiry", 24*time.Hour)
	v.SetDefault("jwt_refresh_expiry", 7*24*time.Hour)
	v.SetDefault("activity_timeout", 120*time.Second)
	v.SetDefault("ping_interval", 30*time.Second)
	v.SetDefault("max_connections_per_app", 10000)
	v.SetDefault("rate_limit_rps", 1000)
	v.SetDefault("webhook_timeout", 5*time.Second)
	v.SetDefault("webhook_max_retries", 5)
	v.SetDefault("allow_mock_push", true)

	v.SetEnvPrefix("APS")
	v.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))
	v.AutomaticEnv()

	// Optionally load .env file if present
	v.SetConfigFile(".env")
	v.SetConfigType("env")
	_ = v.ReadInConfig()

	var cfg Config
	if err := v.Unmarshal(&cfg); err != nil {
		return nil, err
	}

	return &cfg, nil
}

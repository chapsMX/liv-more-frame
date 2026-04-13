{
  "note": "Solo tablas con prefijo 2026_ (nueva versión). El resto de la BD es legado.",
  "tables": [
    {
      "table_name": "2026_daily_steps",
      "columns": [
        {
          "column_name": "id",
          "data_type": "integer",
          "is_nullable": "NO",
          "column_default": "nextval('\"2026_daily_steps_id_seq\"'::regclass)"
        },
        {
          "column_name": "user_id",
          "data_type": "integer",
          "is_nullable": "NO",
          "column_default": null
        },
        {
          "column_name": "date",
          "data_type": "date",
          "is_nullable": "NO",
          "column_default": null
        },
        {
          "column_name": "steps",
          "data_type": "integer",
          "is_nullable": "NO",
          "column_default": null
        },
        {
          "column_name": "attestation_hash",
          "data_type": "text",
          "is_nullable": "YES",
          "column_default": null
        },
        {
          "column_name": "attested_at",
          "data_type": "timestamp with time zone",
          "is_nullable": "YES",
          "column_default": null
        },
        {
          "column_name": "created_at",
          "data_type": "timestamp with time zone",
          "is_nullable": "NO",
          "column_default": "now()"
        }
      ]
    },
    {
      "table_name": "2026_garmin_connections",
      "columns": [
        {
          "column_name": "access_token",
          "data_type": "text",
          "is_nullable": "NO",
          "column_default": null
        },
        {
          "column_name": "connection_id",
          "data_type": "integer",
          "is_nullable": "NO",
          "column_default": null
        },
        {
          "column_name": "garmin_user_id",
          "data_type": "text",
          "is_nullable": "NO",
          "column_default": null
        },
        {
          "column_name": "id",
          "data_type": "integer",
          "is_nullable": "NO",
          "column_default": "nextval('\"2026_garmin_connections_id_seq\"'::regclass)"
        },
        {
          "column_name": "token_secret",
          "data_type": "text",
          "is_nullable": "NO",
          "column_default": null
        }
      ]
    },
    {
      "table_name": "2026_oura_connections",
      "columns": [
        {
          "column_name": "refresh_token",
          "data_type": "text",
          "is_nullable": "NO",
          "column_default": null
        },
        {
          "column_name": "access_token",
          "data_type": "text",
          "is_nullable": "NO",
          "column_default": null
        },
        {
          "column_name": "oura_user_id",
          "data_type": "text",
          "is_nullable": "NO",
          "column_default": null
        },
        {
          "column_name": "connected_at",
          "data_type": "timestamp with time zone",
          "is_nullable": "NO",
          "column_default": "now()"
        },
        {
          "column_name": "token_expires_at",
          "data_type": "timestamp with time zone",
          "is_nullable": "NO",
          "column_default": null
        },
        {
          "column_name": "connection_id",
          "data_type": "integer",
          "is_nullable": "NO",
          "column_default": null
        },
        {
          "column_name": "id",
          "data_type": "integer",
          "is_nullable": "NO",
          "column_default": "nextval('\"2026_oura_connections_id_seq\"'::regclass)"
        }
      ]
    },
    {
      "table_name": "2026_polar_connections",
      "columns": [
        {
          "column_name": "access_token",
          "data_type": "text",
          "is_nullable": "NO",
          "column_default": null
        },
        {
          "column_name": "id",
          "data_type": "integer",
          "is_nullable": "NO",
          "column_default": "nextval('\"2026_polar_connections_id_seq\"'::regclass)"
        },
        {
          "column_name": "connection_id",
          "data_type": "integer",
          "is_nullable": "NO",
          "column_default": null
        },
        {
          "column_name": "polar_user_id",
          "data_type": "bigint",
          "is_nullable": "NO",
          "column_default": null
        },
        {
          "column_name": "token_expires_at",
          "data_type": "timestamp with time zone",
          "is_nullable": "YES",
          "column_default": null
        },
        {
          "column_name": "connected_at",
          "data_type": "timestamp with time zone",
          "is_nullable": "NO",
          "column_default": "now()"
        },
        {
          "column_name": "member_id",
          "data_type": "text",
          "is_nullable": "NO",
          "column_default": null
        }
      ]
    },
    {
      "table_name": "2026_provider_connections",
      "columns": [
        {
          "column_name": "user_id",
          "data_type": "integer",
          "is_nullable": "NO",
          "column_default": null
        },
        {
          "column_name": "disconnected_at",
          "data_type": "timestamp with time zone",
          "is_nullable": "YES",
          "column_default": null
        },
        {
          "column_name": "provider",
          "data_type": "text",
          "is_nullable": "NO",
          "column_default": null
        },
        {
          "column_name": "id",
          "data_type": "integer",
          "is_nullable": "NO",
          "column_default": "nextval('\"2026_provider_connections_id_seq\"'::regclass)"
        },
        {
          "column_name": "connected_at",
          "data_type": "timestamp with time zone",
          "is_nullable": "NO",
          "column_default": "now()"
        }
      ]
    },
    {
      "table_name": "2026_records",
      "columns": [
        {
          "column_name": "steps",
          "data_type": "integer",
          "is_nullable": "NO",
          "column_default": null
        },
        {
          "column_name": "record_type",
          "data_type": "text",
          "is_nullable": "NO",
          "column_default": null
        },
        {
          "column_name": "achieved_at",
          "data_type": "timestamp with time zone",
          "is_nullable": "NO",
          "column_default": "now()"
        },
        {
          "column_name": "period_end",
          "data_type": "date",
          "is_nullable": "NO",
          "column_default": null
        },
        {
          "column_name": "id",
          "data_type": "integer",
          "is_nullable": "NO",
          "column_default": "nextval('\"2026_records_id_seq\"'::regclass)"
        },
        {
          "column_name": "user_id",
          "data_type": "integer",
          "is_nullable": "NO",
          "column_default": null
        },
        {
          "column_name": "period_start",
          "data_type": "date",
          "is_nullable": "NO",
          "column_default": null
        }
      ]
    },
    {
      "table_name": "2026_users",
      "columns": [
        {
          "column_name": "provider_access_token",
          "data_type": "text",
          "is_nullable": "YES",
          "column_default": null
        },
        {
          "column_name": "provider_refresh_token",
          "data_type": "text",
          "is_nullable": "YES",
          "column_default": null
        },
        {
          "column_name": "username",
          "data_type": "text",
          "is_nullable": "YES",
          "column_default": null
        },
        {
          "column_name": "eth_address",
          "data_type": "text",
          "is_nullable": "YES",
          "column_default": null
        },
        {
          "column_name": "id",
          "data_type": "integer",
          "is_nullable": "NO",
          "column_default": "nextval('\"2026_users_id_seq\"'::regclass)"
        },
        {
          "column_name": "fid",
          "data_type": "bigint",
          "is_nullable": "NO",
          "column_default": null
        },
        {
          "column_name": "created_at",
          "data_type": "timestamp with time zone",
          "is_nullable": "NO",
          "column_default": "now()"
        },
        {
          "column_name": "provider",
          "data_type": "text",
          "is_nullable": "YES",
          "column_default": null
        },
        {
          "column_name": "provider_token_expires_at",
          "data_type": "timestamp with time zone",
          "is_nullable": "YES",
          "column_default": null
        },
        {
          "column_name": "og",
          "data_type": "boolean",
          "is_nullable": "NO",
          "column_default": "false"
        },
        {
          "column_name": "updated_at",
          "data_type": "timestamp with time zone",
          "is_nullable": "NO",
          "column_default": "now()"
        }
      ]
    },
    {
      "table_name": "2026_weekly_competitions",
      "columns": [
        {
          "column_name": "week_start",
          "data_type": "timestamp with time zone",
          "is_nullable": "NO",
          "column_default": null
        },
        {
          "column_name": "status",
          "data_type": "text",
          "is_nullable": "NO",
          "column_default": "'active'::text"
        },
        {
          "column_name": "year",
          "data_type": "smallint",
          "is_nullable": "NO",
          "column_default": null
        },
        {
          "column_name": "week_number",
          "data_type": "smallint",
          "is_nullable": "NO",
          "column_default": null
        },
        {
          "column_name": "id",
          "data_type": "integer",
          "is_nullable": "NO",
          "column_default": "nextval('\"2026_weekly_competitions_id_seq\"'::regclass)"
        },
        {
          "column_name": "created_at",
          "data_type": "timestamp with time zone",
          "is_nullable": "NO",
          "column_default": "now()"
        },
        {
          "column_name": "week_end",
          "data_type": "timestamp with time zone",
          "is_nullable": "NO",
          "column_default": null
        },
        {
          "column_name": "pool_amount",
          "data_type": "numeric",
          "is_nullable": "YES",
          "column_default": null
        },
        {
          "column_name": "accumulated",
          "data_type": "numeric",
          "is_nullable": "YES",
          "column_default": "0"
        }
      ]
    },
    {
      "table_name": "2026_weekly_winners",
      "columns": [
        {
          "column_name": "prize_amount",
          "data_type": "numeric",
          "is_nullable": "YES",
          "column_default": null
        },
        {
          "column_name": "rank",
          "data_type": "smallint",
          "is_nullable": "YES",
          "column_default": null
        },
        {
          "column_name": "user_id",
          "data_type": "integer",
          "is_nullable": "NO",
          "column_default": null
        },
        {
          "column_name": "created_at",
          "data_type": "timestamp with time zone",
          "is_nullable": "NO",
          "column_default": "now()"
        },
        {
          "column_name": "category",
          "data_type": "text",
          "is_nullable": "NO",
          "column_default": null
        },
        {
          "column_name": "total_valid_steps",
          "data_type": "integer",
          "is_nullable": "NO",
          "column_default": null
        },
        {
          "column_name": "id",
          "data_type": "integer",
          "is_nullable": "NO",
          "column_default": "nextval('\"2026_weekly_winners_id_seq\"'::regclass)"
        },
        {
          "column_name": "competition_id",
          "data_type": "integer",
          "is_nullable": "NO",
          "column_default": null
        },
        {
          "column_name": "prize_percentage",
          "data_type": "numeric",
          "is_nullable": "YES",
          "column_default": null
        },
        {
          "column_name": "prize_tx_hash",
          "data_type": "text",
          "is_nullable": "YES",
          "column_default": null
        }
      ]
    }
  ],
  "foreignKeys": [
    {
      "table_name": "2026_daily_steps",
      "column_name": "user_id",
      "foreign_table_name": "2026_users",
      "foreign_column_name": "id"
    },
    {
      "table_name": "2026_garmin_connections",
      "column_name": "connection_id",
      "foreign_table_name": "2026_provider_connections",
      "foreign_column_name": "id"
    },
    {
      "table_name": "2026_oura_connections",
      "column_name": "connection_id",
      "foreign_table_name": "2026_provider_connections",
      "foreign_column_name": "id"
    },
    {
      "table_name": "2026_polar_connections",
      "column_name": "connection_id",
      "foreign_table_name": "2026_provider_connections",
      "foreign_column_name": "id"
    },
    {
      "table_name": "2026_provider_connections",
      "column_name": "user_id",
      "foreign_table_name": "2026_users",
      "foreign_column_name": "id"
    },
    {
      "table_name": "2026_records",
      "column_name": "user_id",
      "foreign_table_name": "2026_users",
      "foreign_column_name": "id"
    },
    {
      "table_name": "2026_weekly_winners",
      "column_name": "competition_id",
      "foreign_table_name": "2026_weekly_competitions",
      "foreign_column_name": "id"
    },
    {
      "table_name": "2026_weekly_winners",
      "column_name": "user_id",
      "foreign_table_name": "2026_users",
      "foreign_column_name": "id"
    }
  ],
  "indices": [
    {
      "table_name": "2026_daily_steps",
      "index_name": "2026_daily_steps_pkey",
      "index_definition": "CREATE UNIQUE INDEX \"2026_daily_steps_pkey\" ON public.\"2026_daily_steps\" USING btree (id)"
    },
    {
      "table_name": "2026_daily_steps",
      "index_name": "2026_daily_steps_user_id_date_key",
      "index_definition": "CREATE UNIQUE INDEX \"2026_daily_steps_user_id_date_key\" ON public.\"2026_daily_steps\" USING btree (user_id, date)"
    },
    {
      "table_name": "2026_daily_steps",
      "index_name": "idx_2026_daily_steps_date",
      "index_definition": "CREATE INDEX idx_2026_daily_steps_date ON public.\"2026_daily_steps\" USING btree (date)"
    },
    {
      "table_name": "2026_daily_steps",
      "index_name": "idx_2026_daily_steps_user_date",
      "index_definition": "CREATE INDEX idx_2026_daily_steps_user_date ON public.\"2026_daily_steps\" USING btree (user_id, date)"
    },
    {
      "table_name": "2026_daily_steps",
      "index_name": "idx_2026_daily_steps_user_id",
      "index_definition": "CREATE INDEX idx_2026_daily_steps_user_id ON public.\"2026_daily_steps\" USING btree (user_id)"
    },
    {
      "table_name": "2026_garmin_connections",
      "index_name": "2026_garmin_connections_garmin_user_id_key",
      "index_definition": "CREATE UNIQUE INDEX \"2026_garmin_connections_garmin_user_id_key\" ON public.\"2026_garmin_connections\" USING btree (garmin_user_id)"
    },
    {
      "table_name": "2026_garmin_connections",
      "index_name": "2026_garmin_connections_pkey",
      "index_definition": "CREATE UNIQUE INDEX \"2026_garmin_connections_pkey\" ON public.\"2026_garmin_connections\" USING btree (id)"
    },
    {
      "table_name": "2026_oura_connections",
      "index_name": "2026_oura_connections_connection_id_key",
      "index_definition": "CREATE UNIQUE INDEX \"2026_oura_connections_connection_id_key\" ON public.\"2026_oura_connections\" USING btree (connection_id)"
    },
    {
      "table_name": "2026_oura_connections",
      "index_name": "2026_oura_connections_oura_user_id_key",
      "index_definition": "CREATE UNIQUE INDEX \"2026_oura_connections_oura_user_id_key\" ON public.\"2026_oura_connections\" USING btree (oura_user_id)"
    },
    {
      "table_name": "2026_oura_connections",
      "index_name": "2026_oura_connections_pkey",
      "index_definition": "CREATE UNIQUE INDEX \"2026_oura_connections_pkey\" ON public.\"2026_oura_connections\" USING btree (id)"
    },
    {
      "table_name": "2026_polar_connections",
      "index_name": "2026_polar_connections_connection_id_key",
      "index_definition": "CREATE UNIQUE INDEX \"2026_polar_connections_connection_id_key\" ON public.\"2026_polar_connections\" USING btree (connection_id)"
    },
    {
      "table_name": "2026_polar_connections",
      "index_name": "2026_polar_connections_pkey",
      "index_definition": "CREATE UNIQUE INDEX \"2026_polar_connections_pkey\" ON public.\"2026_polar_connections\" USING btree (id)"
    },
    {
      "table_name": "2026_polar_connections",
      "index_name": "2026_polar_connections_polar_user_id_key",
      "index_definition": "CREATE UNIQUE INDEX \"2026_polar_connections_polar_user_id_key\" ON public.\"2026_polar_connections\" USING btree (polar_user_id)"
    },
    {
      "table_name": "2026_provider_connections",
      "index_name": "2026_provider_connections_pkey",
      "index_definition": "CREATE UNIQUE INDEX \"2026_provider_connections_pkey\" ON public.\"2026_provider_connections\" USING btree (id)"
    },
    {
      "table_name": "2026_provider_connections",
      "index_name": "2026_provider_connections_user_id_key",
      "index_definition": "CREATE UNIQUE INDEX \"2026_provider_connections_user_id_key\" ON public.\"2026_provider_connections\" USING btree (user_id)"
    },
    {
      "table_name": "2026_records",
      "index_name": "2026_records_pkey",
      "index_definition": "CREATE UNIQUE INDEX \"2026_records_pkey\" ON public.\"2026_records\" USING btree (id)"
    },
    {
      "table_name": "2026_records",
      "index_name": "2026_records_record_type_key",
      "index_definition": "CREATE UNIQUE INDEX \"2026_records_record_type_key\" ON public.\"2026_records\" USING btree (record_type)"
    },
    {
      "table_name": "2026_records",
      "index_name": "idx_2026_records_record_type",
      "index_definition": "CREATE INDEX idx_2026_records_record_type ON public.\"2026_records\" USING btree (record_type)"
    },
    {
      "table_name": "2026_users",
      "index_name": "2026_users_fid_key",
      "index_definition": "CREATE UNIQUE INDEX \"2026_users_fid_key\" ON public.\"2026_users\" USING btree (fid)"
    },
    {
      "table_name": "2026_users",
      "index_name": "2026_users_pkey",
      "index_definition": "CREATE UNIQUE INDEX \"2026_users_pkey\" ON public.\"2026_users\" USING btree (id)"
    },
    {
      "table_name": "2026_users",
      "index_name": "idx_2026_users_fid",
      "index_definition": "CREATE INDEX idx_2026_users_fid ON public.\"2026_users\" USING btree (fid)"
    },
    {
      "table_name": "2026_weekly_competitions",
      "index_name": "2026_weekly_competitions_pkey",
      "index_definition": "CREATE UNIQUE INDEX \"2026_weekly_competitions_pkey\" ON public.\"2026_weekly_competitions\" USING btree (id)"
    },
    {
      "table_name": "2026_weekly_competitions",
      "index_name": "2026_weekly_competitions_week_number_year_key",
      "index_definition": "CREATE UNIQUE INDEX \"2026_weekly_competitions_week_number_year_key\" ON public.\"2026_weekly_competitions\" USING btree (week_number, year)"
    },
    {
      "table_name": "2026_weekly_winners",
      "index_name": "2026_weekly_winners_competition_id_category_rank_key",
      "index_definition": "CREATE UNIQUE INDEX \"2026_weekly_winners_competition_id_category_rank_key\" ON public.\"2026_weekly_winners\" USING btree (competition_id, category, rank)"
    },
    {
      "table_name": "2026_weekly_winners",
      "index_name": "2026_weekly_winners_competition_id_category_user_id_key",
      "index_definition": "CREATE UNIQUE INDEX \"2026_weekly_winners_competition_id_category_user_id_key\" ON public.\"2026_weekly_winners\" USING btree (competition_id, category, user_id)"
    },
    {
      "table_name": "2026_weekly_winners",
      "index_name": "2026_weekly_winners_pkey",
      "index_definition": "CREATE UNIQUE INDEX \"2026_weekly_winners_pkey\" ON public.\"2026_weekly_winners\" USING btree (id)"
    }
  ]
}
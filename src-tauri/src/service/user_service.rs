use crate::error::CommonError;
use crate::utils::crypto;
use crate::utils::secure_store::SecureStore;
use chrono::Local;
use entity::im_user;
use entity::prelude::ImUserEntity;
use sea_orm::ActiveValue::Set;
use sea_orm::{ColumnTrait, ConnectionTrait, EntityTrait, IntoActiveModel, QueryFilter};
use tracing::{debug, info, warn};

pub struct UserService;

impl UserService {
    pub async fn save_user_info<C>(db: &C, uid: &str) -> Result<(), CommonError>
    where
        C: ConnectionTrait,
    {
        let exists = ImUserEntity::find()
            .filter(im_user::Column::Id.eq(uid))
            .one(db)
            .await
            .map_err(|e| CommonError::DatabaseError(e))?;

        if exists.is_none() {
            info!("User does not exist, inserting new user: {}", uid);
            let user = im_user::ActiveModel {
                id: Set(uid.to_string()),
                is_init: Set(true),
                ..Default::default()
            };
            im_user::Entity::insert(user)
                .exec(db)
                .await
                .map_err(|e| CommonError::DatabaseError(e))?;
        } else {
            debug!("User already exists: {}", uid);
        }
        Ok(())
    }

    pub async fn update_last_opt_time<C>(db: &C, uid: &str) -> Result<(), CommonError>
    where
        C: ConnectionTrait,
    {
        let user = ImUserEntity::find()
            .filter(im_user::Column::Id.eq(uid))
            .one(db)
            .await
            .map_err(|e| CommonError::DatabaseError(e))?;

        if let Some(user) = user {
            let mut active_model = user.into_active_model();
            active_model.last_opt_time = Set(Some(Local::now().timestamp_millis()));
            ImUserEntity::update(active_model)
                .exec(db)
                .await
                .map_err(|e| CommonError::DatabaseError(e))?;
        }
        Ok(())
    }

    pub async fn save_tokens<C>(
        db: &C,
        uid: &str,
        token: &str,
        refresh_token: &str,
    ) -> Result<(), CommonError>
    where
        C: ConnectionTrait,
    {
        let encrypted_token =
            crypto::encrypt(token).map_err(|e| CommonError::UnexpectedError(e))?;

        let existing_user = ImUserEntity::find()
            .filter(im_user::Column::Id.eq(uid))
            .one(db)
            .await
            .map_err(|e| CommonError::DatabaseError(e))?;

        let refresh_to_save = if refresh_token.is_empty() {
            match &existing_user {
                Some(u) => u.refresh_token.clone().unwrap_or_default(),
                None => String::new(),
            }
        } else {
            crypto::encrypt(refresh_token).map_err(|e| CommonError::UnexpectedError(e))?
        };

        let user_update = if existing_user.is_some() {
            im_user::ActiveModel {
                id: Set(uid.to_string()),
                token: Set(Some(encrypted_token)),
                refresh_token: Set(Some(refresh_to_save)),
                ..Default::default()
            }
        } else {
            im_user::ActiveModel {
                id: Set(uid.to_string()),
                token: Set(Some(encrypted_token)),
                refresh_token: Set(Some(refresh_to_save)),
                is_init: Set(true),
                ..Default::default()
            }
        };

        if existing_user.is_some() {
            ImUserEntity::update(user_update)
                .exec(db)
                .await
                .map_err(|e| CommonError::DatabaseError(e))?;
            info!("User {} token updated", uid);
        } else {
            ImUserEntity::insert(user_update)
                .exec(db)
                .await
                .map_err(|e| CommonError::DatabaseError(e))?;
            info!("New user {} created with token", uid);
        }
        Ok(())
    }

    pub async fn get_tokens<C>(db: &C, uid: &str) -> Result<Option<(String, String)>, CommonError>
    where
        C: ConnectionTrait,
    {
        let user = ImUserEntity::find()
            .filter(im_user::Column::Id.eq(uid))
            .one(db)
            .await
            .map_err(|e| CommonError::DatabaseError(e))?;

        match user {
            Some(u) => match (u.token, u.refresh_token) {
                (Some(enc_tok), Some(enc_ref)) => {
                    let token = crypto::decrypt(&enc_tok).unwrap_or_else(|_| {
                        warn!("Failed to decrypt token for {}, assuming plain text", uid);
                        enc_tok
                    });
                    let refresh = crypto::decrypt(&enc_ref).unwrap_or_else(|_| {
                        warn!(
                            "Failed to decrypt refresh_token for {}, assuming plain text",
                            uid
                        );
                        enc_ref
                    });
                    Ok(Some((token, refresh)))
                }
                _ => Ok(None),
            },
            None => Ok(None),
        }
    }

    pub fn store_token_in_secure_storage(uid: &str, token: &str) {
        let secure_key = format!("matrix_token_{}", uid);
        if let Err(e) = SecureStore::set(&secure_key, token) {
            warn!("Failed to store token in secure storage: {}", e);
        }
    }

    pub fn delete_secure_token(uid: &str) {
        let secure_key = format!("matrix_token_{}", uid);
        if let Err(e) = SecureStore::delete(&secure_key) {
            warn!("Failed to delete token from secure storage: {}", e);
        }
    }
}

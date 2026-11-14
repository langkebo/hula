use crate::error::CommonError;
use crate::utils::crypto;
use entity::im_user;
use entity::prelude::ImUserEntity;
use sea_orm::{ActiveValue::Set, ColumnTrait, ConnectionTrait, EntityTrait, QueryFilter};
use tracing::{error, info, warn};

/// 更新用户的 is_init 状态
pub async fn update_user_init_status<C>(
    db: &C,
    login_uid: &str,
    is_init: bool,
) -> Result<(), CommonError>
where
    C: ConnectionTrait,
{
    let user_update = im_user::ActiveModel {
        id: Set(login_uid.to_string()),
        is_init: Set(is_init),
        ..Default::default()
    };

    match ImUserEntity::update(user_update).exec(db).await {
        Ok(_) => {
            info!("User {} is_init status updated to {}", login_uid, is_init);
            Ok(())
        }
        Err(e) => {
            error!("Failed to update user is_init status: {:?}", e);
            Err(e.into())
        }
    }
}

/// 保存或更新用户的 token 信息
pub async fn save_user_tokens<C>(
    db: &C,
    login_uid: &str,
    token: &str,
    refresh_token: &str,
) -> Result<(), CommonError>
where
    C: ConnectionTrait,
{
    // 对 token 进行加密
    let encrypted_token = crypto::encrypt(token).map_err(|e| {
        error!("Failed to encrypt token: {:?}", e);
        CommonError::UnexpectedError(e)
    })?;

    // 检查用户是否已存在
    let existing_user = ImUserEntity::find()
        .filter(im_user::Column::Id.eq(login_uid))
        .one(db)
        .await
        .map_err(|e| {
            error!("Failed to query user for token update: {:?}", e);
            CommonError::DatabaseError(e)
        })?;

    let refresh_token_to_save = if refresh_token.is_empty() {
        if let Some(user) = &existing_user {
            if let Some(saved_refresh) = user.refresh_token.clone() {
                if !saved_refresh.is_empty() {
                    saved_refresh
                } else {
                    "".to_string()
                }
            } else {
                "".to_string()
            }
        } else {
            "".to_string()
        }
    } else {
        // 对新 refresh_token 进行加密
        crypto::encrypt(refresh_token).map_err(|e| {
            error!("Failed to encrypt refresh_token: {:?}", e);
            CommonError::UnexpectedError(e)
        })?
    };

    let user_update = if existing_user.is_some() {
        // 用户存在，更新 token 信息
        im_user::ActiveModel {
            id: Set(login_uid.to_string()),
            token: Set(Some(encrypted_token)),
            refresh_token: Set(Some(refresh_token_to_save.clone())),
            ..Default::default()
        }
    } else {
        // 用户不存在，创建新用户并设置 token 信息
        im_user::ActiveModel {
            id: Set(login_uid.to_string()),
            token: Set(Some(encrypted_token)),
            refresh_token: Set(Some(refresh_token_to_save.clone())),
            is_init: Set(true), // 新用户默认未初始化
            ..Default::default()
        }
    };

    if existing_user.is_some() {
        // 更新现有用户
        match ImUserEntity::update(user_update).exec(db).await {
            Ok(_) => {
                info!("User {} token info updated successfully", login_uid);
                Ok(())
            }
            Err(e) => {
                error!("Failed to update user token info: {:?}", e);
                Err(e.into())
            }
        }
    } else {
        // 插入新用户
        match ImUserEntity::insert(user_update).exec(db).await {
            Ok(_) => {
                info!("New user {} created with token info", login_uid);
                Ok(())
            }
            Err(e) => {
                error!("Failed to create user with token info: {:?}", e);
                Err(e.into())
            }
        }
    }
}

/// 获取用户的 token 信息
pub async fn get_user_tokens<C>(
    db: &C,
    login_uid: &str,
) -> Result<Option<(String, String)>, CommonError>
where
    C: ConnectionTrait,
{
    let user = ImUserEntity::find()
        .filter(im_user::Column::Id.eq(login_uid))
        .one(db)
        .await
        .map_err(|e| {
            error!("Failed to query user tokens: {:?}", e);
            CommonError::DatabaseError(e)
        })?;

    match user {
        Some(user) => {
            if let (Some(enc_token), Some(enc_refresh_token)) = (user.token, user.refresh_token) {
                // 尝试解密 token
                let token = crypto::decrypt(&enc_token).unwrap_or_else(|_| {
                    warn!(
                        "Failed to decrypt token for {}, assuming plain text (migration)",
                        login_uid
                    );
                    enc_token
                });

                // 尝试解密 refresh_token
                let refresh_token = crypto::decrypt(&enc_refresh_token).unwrap_or_else(|_| {
                    warn!(
                        "Failed to decrypt refresh_token for {}, assuming plain text (migration)",
                        login_uid
                    );
                    enc_refresh_token
                });

                Ok(Some((token, refresh_token)))
            } else {
                Ok(None)
            }
        }
        None => Ok(None),
    }
}

/// 冷启动回填：取**最近活跃**且已持久化 token 的用户（uid + 解密后的 token/refresh_token）。
///
/// 为什么需要（D2-R）：`get_user_tokens` 命令只读内存里的 `state.user_info`，
/// 而 `initialize_app_data` 构造它时四个字段恒为 `Default`（空）且从不回填 ⇒
/// 冷启动后前端 `hasAuthenticatedSession()` 恒为 false，原生路径永远回登录页
/// （实测设备上 `invoke('get_user_tokens')` 返回 `{uid:null, token:""}`，
/// 但同一台设备上 `backend=android_keystore` 读写都是通的）。
///
/// 排序取 `last_opt_time`（登录/操作时刷新）→ `update_time` 兜底，与前端「最后登录用户」一致。
pub async fn get_last_active_user_tokens<C>(
    db: &C,
) -> Result<Option<(String, String, String)>, CommonError>
where
    C: ConnectionTrait,
{
    use sea_orm::QueryOrder;

    let user = ImUserEntity::find()
        .filter(im_user::Column::Token.is_not_null())
        .order_by_desc(im_user::Column::LastOptTime)
        .order_by_desc(im_user::Column::UpdateTime)
        .one(db)
        .await
        .map_err(|e| {
            error!(
                "Failed to query last active user for session restore: {:?}",
                e
            );
            CommonError::DatabaseError(e)
        })?;

    let Some(user) = user else { return Ok(None) };
    let Some(enc_token) = user.token else {
        return Ok(None);
    };
    if enc_token.is_empty() {
        return Ok(None);
    }

    let uid = user.id.clone();
    // 与 `get_user_tokens` 同口径：解密失败按明文处理（兼容旧数据/迁移前写入）
    let token = crypto::decrypt(&enc_token).unwrap_or_else(|_| {
        warn!(
            "Failed to decrypt stored token for {}, assuming plain text",
            uid
        );
        enc_token
    });
    let encrypted_refresh = user.refresh_token.unwrap_or_default();
    let refresh_token = if encrypted_refresh.is_empty() {
        String::new()
    } else {
        crypto::decrypt(&encrypted_refresh).unwrap_or_else(|_| {
            warn!(
                "Failed to decrypt stored refresh_token for {}, assuming plain text",
                uid
            );
            encrypted_refresh
        })
    };

    Ok(Some((uid, token, refresh_token)))
}

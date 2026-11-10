package com.plugin.hula

import android.app.Activity
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import app.tauri.plugin.Invoke
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

@InvokeArg
class PingArgs {
  var value: String? = null
}

/**
 * Android Keystore 加解密参数（D2）。
 *
 * keyring 3.x 没有 Android 后端，secure storage 只能退化为 master-key 加密文件；
 * 这里提供系统密钥库（AndroidKeyStore）保护的 AES/GCM 加解密，作为原生后端。
 */
@InvokeArg
class KeystoreEncryptArgs {
  var plaintext: String? = null
}

@InvokeArg
class KeystoreDecryptArgs {
  var payload: String? = null
}

@TauriPlugin
class ExamplePlugin(private val activity: Activity): Plugin(activity) {
    private val implementation = Example()

    companion object {
        private const val KEYSTORE_PROVIDER = "AndroidKeyStore"
        private const val KEY_ALIAS = "hula-secure-store-v1"
        private const val TRANSFORMATION = "AES/GCM/NoPadding"
        private const val GCM_TAG_BITS = 128
        private const val GCM_IV_BYTES = 12
    }

    @Command
    fun ping(invoke: Invoke) {
        val args = invoke.parseArgs(PingArgs::class.java)

        val ret = JSObject()
        ret.put("value", implementation.pong(args.value ?: "default value :("))
        invoke.resolve(ret)
    }

    /**
     * 用 Android Keystore 中的 AES 密钥加密，返回 base64(iv || ciphertext)。
     *
     * IV 由系统在每次 ENCRYPT_MODE 初始化时随机生成，随密文一起返回，
     * 解密侧据此重建 GCMParameterSpec。
     */
    @Command
    fun keystoreEncrypt(invoke: Invoke) {
        val args = invoke.parseArgs(KeystoreEncryptArgs::class.java)
        val plaintext = args.plaintext
        if (plaintext == null) {
            invoke.reject("plaintext is required")
            return
        }
        try {
            val cipher = Cipher.getInstance(TRANSFORMATION)
            cipher.init(Cipher.ENCRYPT_MODE, obtainSecretKey())
            val iv = cipher.iv
            val ciphertext = cipher.doFinal(plaintext.toByteArray(Charsets.UTF_8))
            val combined = ByteArray(iv.size + ciphertext.size)
            System.arraycopy(iv, 0, combined, 0, iv.size)
            System.arraycopy(ciphertext, 0, combined, iv.size, ciphertext.size)

            val ret = JSObject()
            ret.put("payload", Base64.encodeToString(combined, Base64.NO_WRAP))
            invoke.resolve(ret)
        } catch (e: Exception) {
            invoke.reject("android keystore encrypt failed: ${e.message}")
        }
    }

    /** 解密 [keystoreEncrypt] 产出的 base64(iv || ciphertext)，返回明文。 */
    @Command
    fun keystoreDecrypt(invoke: Invoke) {
        val args = invoke.parseArgs(KeystoreDecryptArgs::class.java)
        val payload = args.payload
        if (payload == null) {
            invoke.reject("payload is required")
            return
        }
        try {
            val combined = Base64.decode(payload, Base64.NO_WRAP)
            if (combined.size <= GCM_IV_BYTES) {
                invoke.reject("android keystore payload is too short")
                return
            }
            val iv = combined.copyOfRange(0, GCM_IV_BYTES)
            val ciphertext = combined.copyOfRange(GCM_IV_BYTES, combined.size)
            val cipher = Cipher.getInstance(TRANSFORMATION)
            cipher.init(Cipher.DECRYPT_MODE, obtainSecretKey(), GCMParameterSpec(GCM_TAG_BITS, iv))
            val plaintext = cipher.doFinal(ciphertext)

            val ret = JSObject()
            ret.put("payload", String(plaintext, Charsets.UTF_8))
            invoke.resolve(ret)
        } catch (e: Exception) {
            invoke.reject("android keystore decrypt failed: ${e.message}")
        }
    }

    /** 取出（必要时生成）Keystore 中的 AES-256 密钥。 */
    @Synchronized
    private fun obtainSecretKey(): SecretKey {
        val keyStore = KeyStore.getInstance(KEYSTORE_PROVIDER).apply { load(null) }
        (keyStore.getEntry(KEY_ALIAS, null) as? KeyStore.SecretKeyEntry)?.let { return it.secretKey }

        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE_PROVIDER)
        generator.init(
            KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build()
        )
        return generator.generateKey()
    }
}

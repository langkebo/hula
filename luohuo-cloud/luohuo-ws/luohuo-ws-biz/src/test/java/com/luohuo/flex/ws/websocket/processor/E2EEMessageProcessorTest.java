package com.luohuo.flex.ws.websocket.processor;

import com.fasterxml.jackson.databind.JsonNode;
import com.luohuo.basic.jackson.JsonUtil;
import reactor.core.publisher.Mono;
import com.luohuo.basic.context.ContextUtil;
import com.luohuo.flex.im.core.e2ee.service.E2EEMessageService;
import com.luohuo.flex.im.domain.dto.SaveEncryptedMessageDTO;
import com.luohuo.flex.im.domain.dto.SessionKeyPackageDTO;
import com.luohuo.flex.im.domain.enums.EncryptionAlgorithm;
import com.luohuo.flex.model.ws.WSBaseReq;
import com.luohuo.flex.ws.websocket.SessionManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.reactive.socket.WebSocketSession;

import java.util.Base64;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import org.mockito.ArgumentCaptor;

/**
 * E2EE WebSocket消息处理器测试
 *
 * @author HuLa Team
 * @since 2025-01-01
 */
@ExtendWith(MockitoExtension.class)
class E2EEMessageProcessorTest {

    @Mock
    private E2EEMessageService e2eeMessageService;

    @Mock
    private SessionManager sessionManager;

    @Mock
    private WebSocketSession webSocketSession;

    @InjectMocks
    private E2EEMessageProcessor e2eeMessageProcessor;

    private final Long USER_ID = 12345L;
    private final String SESSION_ID = "session_001";

    @BeforeEach
    void setUp() {
        when(webSocketSession.getId()).thenReturn(SESSION_ID);
        when(sessionManager.sendMessageToSession(anyString(), any()))
            .thenReturn(Mono.empty());
    }

    @Test
    void testSupports_EncryptedMessageType() {
        // 准备测试数据
        WSBaseReq req = new WSBaseReq();
        req.setType(1001); // 加密消息类型

        // 执行测试
        boolean result = e2eeMessageProcessor.supports(req);

        // 验证
        assertTrue(result);
    }

    @Test
    void testSupports_KeyPackageType() {
        // 准备测试数据
        WSBaseReq req = new WSBaseReq();
        req.setType(1002); // 加密密钥包类型

        // 执行测试
        boolean result = e2eeMessageProcessor.supports(req);

        // 验证
        assertTrue(result);
    }

    @Test
    void testSupports_InvalidType() {
        // 准备测试数据
        WSBaseReq req = new WSBaseReq();
        req.setType(999); // 无效类型

        // 执行测试
        boolean result = e2eeMessageProcessor.supports(req);

        // 验证
        assertFalse(result);
    }

    @Test
    void testSupports_NullRequest() {
        // 执行测试
        boolean result = e2eeMessageProcessor.supports(null);

        // 验证
        assertFalse(result);
    }

    @Test
    void testProcess_EncryptedMessage_Success() throws Exception {
        // 准备测试数据
        try (MockedStatic<ContextUtil> contextUtil = mockStatic(ContextUtil.class)) {
            contextUtil.when(ContextUtil::getUserId).thenReturn(USER_ID);

            WSBaseReq req = new WSBaseReq();
            req.setType(1001); // 加密消息类型
            req.setData(createEncryptedMessageJson());

            // 模拟服务层
            when(e2eeMessageService.saveEncryptedMessage(any(SaveEncryptedMessageDTO.class)))
                .thenReturn(12345L);

            // 执行测试
            assertDoesNotThrow(() -> e2eeMessageProcessor.process(webSocketSession, USER_ID, req));

            // 验证
            verify(e2eeMessageService).saveEncryptedMessage(any(SaveEncryptedMessageDTO.class));
            ArgumentCaptor<WSBaseReq> captor = ArgumentCaptor.forClass(WSBaseReq.class);
            verify(sessionManager).sendMessageToSession(eq(SESSION_ID), captor.capture());
            WSBaseReq pushed = captor.getValue();
            assertNotNull(pushed.getData());
            assertTrue(pushed.getData().toString().contains("\"type\":\"encrypted_message\""));
        }
    }

    @Test
    void testProcess_KeyPackage_Success() throws Exception {
        // 准备测试数据
        try (MockedStatic<ContextUtil> contextUtil = mockStatic(ContextUtil.class)) {
            contextUtil.when(ContextUtil::getUserId).thenReturn(USER_ID);

            WSBaseReq req = new WSBaseReq();
            req.setType(1002); // 密钥包类型
            req.setData(createKeyPackageJson());

            // 执行测试
            assertDoesNotThrow(() -> e2eeMessageProcessor.process(webSocketSession, USER_ID, req));

            // 验证
            verify(e2eeMessageService).distributeSessionKey(any(SessionKeyPackageDTO.class));
            verify(sessionManager).sendMessageToSession(eq(SESSION_ID), any(WSBaseReq.class));
            ArgumentCaptor<WSBaseReq> captor = ArgumentCaptor.forClass(WSBaseReq.class);
            verify(sessionManager).sendToUser(eq(654321L), captor.capture());
            WSBaseReq pushed = captor.getValue();
            assertTrue(pushed.getData().toString().contains("encrypted_key_package"));
        }
    }

    @Test
    void testProcess_EncryptedMessage_Error() throws Exception {
        // 准备测试数据
        WSBaseReq req = new WSBaseReq();
        req.setType(1001); // 加密消息类型
        req.setData("invalid json"); // 无效的JSON

        // 执行测试
        assertDoesNotThrow(() -> e2eeMessageProcessor.process(webSocketSession, USER_ID, req));

        // 验证错误响应被发送
        verify(sessionManager).sendMessageToSession(eq(SESSION_ID), any(WSBaseReq.class));
    }

    @Test
    void testProcess_ServiceException() throws Exception {
        // 准备测试数据
        try (MockedStatic<ContextUtil> contextUtil = mockStatic(ContextUtil.class)) {
            contextUtil.when(ContextUtil::getUserId).thenReturn(USER_ID);

            WSBaseReq req = new WSBaseReq();
            req.setType(1001);
            req.setData(createEncryptedMessageJson());

            // 模拟服务层异常
            when(e2eeMessageService.saveEncryptedMessage(any(SaveEncryptedMessageDTO.class)))
                .thenThrow(new RuntimeException("Service error"));

            // 执行测试
            assertDoesNotThrow(() -> e2eeMessageProcessor.process(webSocketSession, USER_ID, req));

            // 验证错误响应被发送
            verify(sessionManager).sendMessageToSession(eq(SESSION_ID), any(WSBaseReq.class));
        }
    }

    @Test
    void testParseEncryptedMessage() throws Exception {
        // 准备测试数据
        String json = createEncryptedMessageJson();

        // 使用反射调用私有方法（仅用于测试）
        var method = E2EEMessageProcessor.class.getDeclaredMethod("parseEncryptedMessage", String.class);
        method.setAccessible(true);

        // 执行测试
        SaveEncryptedMessageDTO result = (SaveEncryptedMessageDTO) method.invoke(
            e2eeMessageProcessor, json);

        // 验证
        assertNotNull(result);
        assertEquals("conv_test_001", result.getConversationId());
        assertEquals(654321L, result.getRecipientId());
        assertEquals("session_key_001", result.getKeyId());
        assertEquals(EncryptionAlgorithm.AES_GCM, result.getAlgorithm());
        assertEquals("encrypted_content", new String(result.getCiphertextBytes()));
    }

    @Test
    void testParseKeyPackage() throws Exception {
        // 准备测试数据
        String json = createKeyPackageJson();

        // 使用反射调用私有方法（仅用于测试）
        var method = E2EEMessageProcessor.class.getDeclaredMethod("parseKeyPackage", String.class);
        method.setAccessible(true);

        // 执行测试
        SessionKeyPackageDTO result = (SessionKeyPackageDTO) method.invoke(
            e2eeMessageProcessor, json);

        // 验证
        assertNotNull(result);
        assertEquals("session_test_001", result.getSessionId());
        assertEquals("key_test_001", result.getKeyId());
        assertEquals(654321L, result.getRecipientId());
        assertEquals(EncryptionAlgorithm.AES_GCM, result.getAlgorithm());
        assertEquals("wrapped_key", new String(result.getWrappedKeyBytes()));
    }

    private String createEncryptedMessageJson() {
        return """
            {
                "conversationId": "conv_test_001",
                "recipientId": 654321,
                "roomId": null,
                "keyId": "session_key_001",
                "algorithm": "AES-GCM",
                "ciphertext": "ZW5jcnlwdGVkX2NvbnRlbnQ=",
                "iv": "aXZfMTIzNDU2Nzg=",
                "tag": null,
                "signature": null,
                "contentType": "text",
                "encryptedExtra": null,
                "encryptionTimeMs": 15
            }
            """;
    }

    private String createKeyPackageJson() {
        return """
            {
                "sessionId": "session_test_001",
                "keyId": "key_test_001",
                "recipientId": 654321,
                "wrappedKey": "d3JhcHBlZF9rZXk=",
                "algorithm": "AES-GCM",
                "expiresAt": null,
                "forwardSecret": false,
                "ephemeralPublicKey": null,
                "kdfAlgorithm": null,
                "kdfInfo": null
            }
            """;
    }
}

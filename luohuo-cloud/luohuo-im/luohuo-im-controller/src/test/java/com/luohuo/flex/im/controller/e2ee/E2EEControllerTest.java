package com.luohuo.flex.im.controller.e2ee;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.luohuo.flex.im.core.e2ee.service.E2EEBatchService;
import com.luohuo.flex.im.core.e2ee.service.E2EEKeyService;
import com.luohuo.flex.im.core.e2ee.service.E2EEMessageService;
import com.luohuo.flex.im.domain.vo.UserPublicKeyVO;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Base64;
import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(E2EEController.class)
@AutoConfigureMockMvc(addFilters = false)
@DisplayName("E2EE控制器测试")
class E2EEControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private E2EEKeyService e2eeKeyService;

    @MockBean
    private E2EEBatchService e2eeBatchService;

    @MockBean
    private E2EEMessageService e2eeMessageService;

    @BeforeEach
    void setUp() {
        when(e2eeKeyService.getUserPublicKey(eq(1001L), eq("key_test_001")))
            .thenReturn(UserPublicKeyVO.builder()
                .userId(1001L)
                .keyId("key_test_001")
                .spki("spki_base64")
                .fingerprint("fp")
                .valid(true)
                .build());
    }

    @Test
    @DisplayName("获取用户公钥 - 成功")
    void testGetUserPublicKey_Success() throws Exception {
        mockMvc.perform(get("/e2ee/keys/{userId}", 1001L)
                .param("keyId", "key_test_001"))
            .andExpect(status().isOk());

        verify(e2eeKeyService).getUserPublicKey(1001L, "key_test_001");
    }

    @Test
    @DisplayName("批量获取公钥 - 成功")
    void testBatchGetPublicKeys_Success() throws Exception {
        when(e2eeBatchService.batchGetPublicKeys(any()))
            .thenReturn(Map.of(
                1001L, List.of(UserPublicKeyVO.builder().userId(1001L).keyId("k1").spki("s1").fingerprint("fp1").build()),
                1002L, List.of(UserPublicKeyVO.builder().userId(1002L).keyId("k2").spki("s2").fingerprint("fp2").build())
            ));

        String body = objectMapper.writeValueAsString(Map.of(
            "userIds", List.of(1001L, 1002L),
            "onlyLatest", true,
            "includeExpired", false
        ));

        mockMvc.perform(post("/e2ee/keys/batch")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isOk());

        verify(e2eeBatchService).batchGetPublicKeys(any());
    }

    @Test
    @DisplayName("发送加密消息 - 成功")
    void testSendEncryptedMessage_Success() throws Exception {
        when(e2eeMessageService.saveEncryptedMessage(any()))
            .thenReturn(1L);

        String body = objectMapper.writeValueAsString(Map.of(
            "conversationId", "conv_1",
            "recipientId", 1002L,
            "keyId", "session_key_1",
            "ciphertext", Base64.getEncoder().encodeToString("cipher".getBytes()),
            "iv", Base64.getEncoder().encodeToString("iv".getBytes()),
            "contentType", "text"
        ));

        mockMvc.perform(post("/e2ee/messages")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isOk());

        verify(e2eeMessageService).saveEncryptedMessage(any());
    }

    @Test
    @DisplayName("验证消息签名 - 成功")
    void testVerifyMessageSignature_Success() throws Exception {
        when(e2eeMessageService.verifyMessageSignature(eq(1L), any()))
            .thenReturn(true);

        String body = objectMapper.writeValueAsString(Map.of(
            "signature", Base64.getEncoder().encodeToString("test".getBytes())
        ));

        mockMvc.perform(post("/e2ee/messages/{messageId}/verify", 1L)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isOk());

        verify(e2eeMessageService).verifyMessageSignature(eq(1L), any());
    }
}


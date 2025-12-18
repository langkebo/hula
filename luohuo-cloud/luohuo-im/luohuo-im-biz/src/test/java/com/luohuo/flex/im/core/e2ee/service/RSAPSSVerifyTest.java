package com.luohuo.flex.im.core.e2ee.service;

import org.junit.jupiter.api.Test;

import java.security.*;
import java.security.spec.MGF1ParameterSpec;
import java.security.spec.PSSParameterSpec;
import java.util.Base64;

import static org.junit.jupiter.api.Assertions.*;

public class RSAPSSVerifyTest {

    @Test
    public void testRsaPssVerify() throws Exception {
        KeyPairGenerator kpg = KeyPairGenerator.getInstance("RSA");
        kpg.initialize(2048);
        KeyPair kp = kpg.generateKeyPair();

        String messageData = "123:" + "conv_1:" + "kid_1:" + Base64.getEncoder().encodeToString("abc".getBytes());
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        byte[] messageHash = digest.digest(messageData.getBytes());

        Signature signer = Signature.getInstance("RSASSA-PSS");
        PSSParameterSpec pssSpec = new PSSParameterSpec("SHA-256", "MGF1", MGF1ParameterSpec.SHA256, 32, 1);
        signer.setParameter(pssSpec);
        signer.initSign(kp.getPrivate());
        signer.update(messageHash);
        byte[] sigBytes = signer.sign();

        Signature verifier = Signature.getInstance("RSASSA-PSS");
        verifier.setParameter(pssSpec);
        verifier.initVerify(kp.getPublic());
        verifier.update(messageHash);
        assertTrue(verifier.verify(sigBytes));
    }
}


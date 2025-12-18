package com.luohuo.flex.gateway.controller;

import com.luohuo.flex.config.ThirdpartyProperties;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/anyone/thirdparty")
public class ThirdpartyController {
    private final ThirdpartyProperties props;

    public ThirdpartyController(ThirdpartyProperties props) {
        this.props = props;
    }

    @GetMapping("/status")
    public Map<String, Object> status() {
        Map<String, Object> root = new HashMap<>();

        ThirdpartyProperties.Tencent t = props.getTencent();
        Map<String, Object> tencent = new HashMap<>();
        tencent.put("hasSecret", notEmpty(t.getSecretId()) && notEmpty(t.getSecretKey()));
        tencent.put("hasMapKey", notEmpty(t.getMapKey()));

        ThirdpartyProperties.Wechat w = props.getWechat();
        Map<String, Object> wechat = new HashMap<>();
        wechat.put("hasAppId", notEmpty(w.getAppId()));
        wechat.put("callback", safeValue(w.getCallback()));

        ThirdpartyProperties.Youdao y = props.getYoudao();
        Map<String, Object> youdao = new HashMap<>();
        youdao.put("hasAppKey", notEmpty(y.getAppKey()));

        root.put("tencent", tencent);
        root.put("wechat", wechat);
        root.put("youdao", youdao);
        return root;
    }

    private boolean notEmpty(String s) {
        return s != null && !s.isBlank();
    }

    private String safeValue(String s) {
        return s == null ? "" : s;
    }
}


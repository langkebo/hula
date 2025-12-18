package com.luohuo.flex.im.common.utils.discover;

import jakarta.annotation.Nullable;
import org.jsoup.nodes.Document;
import com.luohuo.flex.im.domain.UrlInfo;

import java.util.Map;

/**
 * @author nyh
 */
public interface UrlDiscover {


    @Nullable
    Map<String, UrlInfo> getUrlContentMap(String content);

    @Nullable
    UrlInfo getContent(String url);

    @Nullable
    String getTitle(Document document);

    @Nullable
    String getDescription(Document document);

    @Nullable
    String getImage(String url, Document document);

    
}

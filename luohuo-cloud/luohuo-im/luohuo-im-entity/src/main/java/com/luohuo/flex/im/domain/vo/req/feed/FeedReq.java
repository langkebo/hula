package com.luohuo.flex.im.domain.vo.req.feed;

import com.luohuo.flex.model.vo.query.OperParam;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import lombok.EqualsAndHashCode;import lombok.EqualsAndHashCode;
/**
 * 查询朋友圈的参数
 */
@Data
@EqualsAndHashCode(callSuper = false)public class FeedReq extends OperParam {

	@NotNull(message = "请选择朋友圈")
	private Long feedId;
}

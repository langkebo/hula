package com.luohuo.flex.model.entity.ws;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serial;
import java.io.Serializable;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ConverseMessageDto implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    private Long fromId;

    private Long toId;

    private String url;

    private Integer type;
}

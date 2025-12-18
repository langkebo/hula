package com.luohuo.flex.entity;


import java.io.Serializable;

public class Init implements Serializable {

	// 系统名称
	private String name;
	// 系统logo
	private String logo;
	// 大群id
	private String roomGroupId;
	// 七牛云配置
	private QiNiu qiNiu;
	// ICE Server 配置
    private IceServer iceServer;

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getLogo() { return logo; }
    public void setLogo(String logo) { this.logo = logo; }
    public String getRoomGroupId() { return roomGroupId; }
    public void setRoomGroupId(String roomGroupId) { this.roomGroupId = roomGroupId; }
    public QiNiu getQiNiu() { return qiNiu; }
    public void setQiNiu(QiNiu qiNiu) { this.qiNiu = qiNiu; }
    public IceServer getIceServer() { return iceServer; }
    public void setIceServer(IceServer iceServer) { this.iceServer = iceServer; }
}

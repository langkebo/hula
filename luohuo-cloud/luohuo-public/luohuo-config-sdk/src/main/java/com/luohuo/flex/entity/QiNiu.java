package com.luohuo.flex.entity;

public class QiNiu {

	private String ossDomain;

	private String fragmentSize;

	// 超过多少容量开启分片
    private String turnSharSize;

    public String getOssDomain() { return ossDomain; }
    public void setOssDomain(String ossDomain) { this.ossDomain = ossDomain; }
    public String getFragmentSize() { return fragmentSize; }
    public void setFragmentSize(String fragmentSize) { this.fragmentSize = fragmentSize; }
    public String getTurnSharSize() { return turnSharSize; }
    public void setTurnSharSize(String turnSharSize) { this.turnSharSize = turnSharSize; }
}

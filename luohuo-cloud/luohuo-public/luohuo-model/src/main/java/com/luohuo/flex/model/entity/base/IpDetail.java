package com.luohuo.flex.model.entity.base;


import java.io.Serializable;


/**
 * 用户ip信息
 * @author nyh
 */
public class IpDetail implements Serializable {

    private static final long serialVersionUID = 1L;
    private String area;
    //注册时的ip
    private String ip;
    //最新登录的ip
    private String isp;
    private String isp_id;
    private String city;
    private String city_id;
    private String country;
    private String country_id;
    private String region;
    private String region_id;

    public IpDetail() {}
    public IpDetail(String area, String ip, String isp, String isp_id, String city, String city_id, String country, String country_id, String region, String region_id) {
        this.area = area;
        this.ip = ip;
        this.isp = isp;
        this.isp_id = isp_id;
        this.city = city;
        this.city_id = city_id;
        this.country = country;
        this.country_id = country_id;
        this.region = region;
        this.region_id = region_id;
    }

    public String getIp() { return ip; }
    public void setIp(String ip) { this.ip = ip; }
    public String getArea() { return area; }
    public void setArea(String area) { this.area = area; }
    public String getIsp() { return isp; }
    public void setIsp(String isp) { this.isp = isp; }
    public String getIsp_id() { return isp_id; }
    public void setIsp_id(String isp_id) { this.isp_id = isp_id; }
    public String getCity() { return city; }
    public void setCity(String city) { this.city = city; }
    public String getCity_id() { return city_id; }
    public void setCity_id(String city_id) { this.city_id = city_id; }
    public String getCountry() { return country; }
    public void setCountry(String country) { this.country = country; }
    public String getCountry_id() { return country_id; }
    public void setCountry_id(String country_id) { this.country_id = country_id; }
    public String getRegion() { return region; }
    public void setRegion(String region) { this.region = region; }
    public String getRegion_id() { return region_id; }
    public void setRegion_id(String region_id) { this.region_id = region_id; }
}

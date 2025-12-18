package com.luohuo.flex.im.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.luohuo.flex.im.domain.entity.SearchHistory;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

/**
 * 搜索历史Mapper
 *
 * @author HuLa
 */
@Mapper
public interface SearchHistoryMapper extends BaseMapper<SearchHistory> {

    /**
     * 查询用户搜索历史
     */
    @Select("""
            SELECT * FROM im_search_history
            WHERE user_id = #{userId}
            AND (#{searchType} IS NULL OR search_type = #{searchType})
            ORDER BY searched_at DESC
            LIMIT #{limit}
            """)
    List<SearchHistory> selectUserSearchHistory(@Param("userId") Long userId,
                                                @Param("searchType") String searchType,
                                                @Param("limit") Integer limit);

    /**
     * 查询热门关键词
     */
    @Select("""
            SELECT keyword, COUNT(*) as count
            FROM im_search_history
            WHERE search_type = #{searchType}
            AND searched_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
            GROUP BY keyword
            ORDER BY count DESC, searched_at DESC
            LIMIT #{limit}
            """)
    List<String> selectHotKeywords(@Param("searchType") String searchType,
                                   @Param("limit") Integer limit);

    /**
     * 获取搜索建议
     */
    @Select("""
            SELECT DISTINCT keyword
            FROM im_search_history
            WHERE user_id = #{userId}
            AND keyword LIKE CONCAT(#{prefix}, '%')
            ORDER BY searched_at DESC
            LIMIT #{limit}
            """)
    List<String> selectSearchSuggestions(@Param("userId") Long userId,
                                         @Param("prefix") String prefix,
                                         @Param("limit") Integer limit);

    /**
     * 清除用户搜索历史
     */
    @Select("""
            DELETE FROM im_search_history
            WHERE user_id = #{userId}
            AND (#{searchType} IS NULL OR search_type = #{searchType})
            """)
    int deleteUserSearchHistory(@Param("userId") Long userId,
                                @Param("searchType") String searchType);

    /**
     * 删除单条搜索历史
     */
    @Select("""
            DELETE FROM im_search_history
            WHERE id = #{id}
            AND user_id = #{userId}
            """)
    int deleteSearchHistory(@Param("id") Long id,
                           @Param("userId") Long userId);
}
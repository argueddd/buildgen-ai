def prepare_chunk_for_insert(chunk,source_info):
    """
    合并 chunk 和 questions，补齐空字段，最终生成入库用 dict。
    """
    return {
        **chunk,
        **source_info
    }
def prepare_chunk_for_insert(chunk,source_info):
    """
    合并 chunk source_info，补齐空字段，最终生成入库
    """
    return {
        **chunk,
        **source_info
    }

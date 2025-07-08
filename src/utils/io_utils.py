from src.split_md_into_chunks import split_markdown_with_parent_titles


def load_markdown_chunks(source_name):
    path = f"./data/output/{source_name}.md"
    with open(path, "r", encoding="utf-8") as f:
        md_text = f.read()
    return split_markdown_with_parent_titles(md_text)
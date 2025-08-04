import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))
from backend.src.infrastructure.envoke_llm import LLMAPIFactory
from backend.src.utils.generate_question_utils import extract_json_block
from backend.src.utils.llm_utils import load_template_and_fill


def generate_keyword_for_query(**query):
    retrial_llm = LLMAPIFactory.create_api()
    prompt = load_template_and_fill(
        template_path="prompt/generate_keyword_for_query.tmpl",
        **query
    )
    llm_ans = retrial_llm.block_chat(prompt)
    return extract_json_block(llm_ans)


if __name__ == '__main__':
    res = generate_keyword_for_query(query="木头保温杯")
    # print(res)

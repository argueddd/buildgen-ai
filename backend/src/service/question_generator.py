import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))
from src.infrastructure.envoke_llm import LLMAPIFactory
from src.utils.generate_question_utils import extract_json_block
from src.utils.llm_utils import load_template_and_fill


def generate_questions_for_chunk(chunk,model_name):

    retrial_llm = LLMAPIFactory.create_api(model_name = model_name)
    prompt = load_template_and_fill(
        template_path="prompt/generate_content_related_questions.tmpl",
        **chunk
    )
    llm_ans = retrial_llm.block_chat(prompt)
    return extract_json_block(llm_ans)

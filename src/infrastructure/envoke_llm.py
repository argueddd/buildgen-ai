import json

import requests
from openai import OpenAI

from src.utils.llm_utils import get_llm_config, collect_stream, load_template_and_fill

API_KEY, BASE_URL, MODEL_TYPE = get_llm_config()


def revoke_llm_deployment_by_vllm(message, base_url, model_path, incremental=True):
    header = {"Content-Type": "application/json"}
    payload = json.dumps({
        "model": model_path,
        "messages": [{"role": "system", "content": "you are a helpful assistant"},
                     {"role": "user", "content": message}],
        "max_tokens": 8000,
        "repetition_penalty": 1.02,
        "temperature": 0.5,
        "stream": "True"
    })

    response = requests.request("POST", base_url, headers=header, data=payload, stream=True, verify=False)
    think_flag = False
    context = ""

    for chunk in response.iter_content(chunk_size=1024):
        if chunk:
            chunk = chunk.decode("utf-8").strip().split("\n\n")
            # print(chunk)
            for msg in chunk:
                if msg == "data: [DONE]":
                    break
                msg = msg.replace("data: ", "")
                js = json.loads(f"{msg}")
                think_chunk = js.get("choices", {})[0].get("delta", {}).get("reasoning_content", "")
                content_chunk = js.get("choices", {})[0].get("delta", {}).get("content", "")
                message_chunk = think_chunk + content_chunk
                if incremental:
                    if think_chunk and not think_flag:
                        think_flag = True
                        yield "<think>"
                    if content_chunk and think_flag:
                        think_flag = False
                        yield "</think>"
                    if message_chunk:
                        yield message_chunk
                else:
                    if think_chunk and not think_flag:
                        think_flag = True
                        context += "<think>"
                        yield context

                    if content_chunk and think_flag:
                        think_flag = False
                        context += "</think>"
                        yield context
                    if message_chunk:
                        context += message_chunk
                        yield context

class LLM_API:
    def __init__(self, api_key, base_url, model_type, temperature=0.3, max_token=2048, top_p=0.8, max_history=20):
        self.client = OpenAI(api_key=api_key, base_url=base_url)
        self.model_type = model_type
        self.temperature = float(temperature)
        self.max_token = int(max_token)
        self.top_p = float(top_p)
        self.max_history = int(max_history)
        self.conversation_history = [
            {'role': 'system', 'content': 'You are a helpful assistant. answer the question with chinese'}
        ]

    def _add_to_history(self, role, content):
        """将对话加入历史并确保历史记录不超出最大长度"""
        self.conversation_history.append({"role": role, "content": content})
        if len(self.conversation_history) > self.max_history:
            self.conversation_history = self.conversation_history[-self.max_history:]

    def _generate_response(self, stream=False):
        """统一生成对话的逻辑，支持流式和块式生成"""
        return self.client.chat.completions.create(
            model=self.model_type,
            messages=self.conversation_history,
            temperature=self.temperature,
            max_tokens=self.max_token,
            top_p=self.top_p,
            stream=stream
        )


    def block_chat(self, prompt):
        self._add_to_history('user', prompt)
        completion = self._generate_response(stream=False)
        assistant_reply = completion.choices[0].message.content.strip()
        self._add_to_history('assistant', assistant_reply)
        print(f"<<<<<<<<<<<<<<<<block_chat_response<<<<<<<<<<<<<<<<\n{assistant_reply}")
        return assistant_reply


    def stream_chat(self, prompt, incremental=True):
        self.clear_history()
        self._add_to_history("user", prompt)
        completion = self._generate_response(stream=True)
        print(f"[LLM: {self.model_type}] stream_chat => response is:\n")
        if incremental:
            for chunk in completion:
                content = chunk.choices[0].delta.content
                if content:
                    yield content
        else:
            cont = ""
            for chunk in completion:
                content = chunk.choices[0].delta.content
                if content:
                    cont += content
                    yield cont

    def clear_history(self):
        self.conversation_history = []

class RagLLMAPI(LLM_API):
    def __init__(self, api_key, base_url, model_type, temperature=0.6, max_token=4096, top_p=0.8, max_history=20):
        super().__init__(api_key, base_url, model_type, temperature, max_token, top_p, max_history)

class LLMAPIFactory:
    @staticmethod
    def create_api(situation='rag'):
        if situation == 'rag':
            return RagLLMAPI(api_key=API_KEY, base_url=BASE_URL, model_type=MODEL_TYPE)
        else:
            raise ValueError(f'situation {situation} not supported')


if __name__ == '__main__':
    print(f"model is {MODEL_TYPE}, base_url is {BASE_URL}")
    retrial_llm = LLMAPIFactory.create_api()
    generate_question_prompt = load_template_and_fill(
        template_path="prompt/generate_content_related_questions.tmpl",
        paragraph = "123"
    )
    llm_ans = retrial_llm.stream_chat(generate_question_prompt)
    llm_ans = collect_stream(llm_ans)
    print(llm_ans)

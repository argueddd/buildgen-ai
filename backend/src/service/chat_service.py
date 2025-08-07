import json
from backend.src.infrastructure.envoke_llm import LLMAPIFactory

class ChatService:
    def __init__(self):
        self.llm = None
        self.current_model = None

    
    def stream_chat(self, question, context='', model_name=None):
        """流式智能问答"""
        if not question:
            raise ValueError('问题不能为空')
        
        prompt = f"""基于以下上下文信息回答问题：

上下文：
{context}

问题：{question}

请基于上下文信息给出准确、详细的回答。如果上下文中没有相关信息，请说明无法基于现有信息回答。"""
        
        llm = LLMAPIFactory().create_api(model_name = model_name)
        for chunk in llm.stream_chat(prompt):
            yield chunk
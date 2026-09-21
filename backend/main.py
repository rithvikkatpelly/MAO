from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from llm import MODEL_NAME, get_llm

app = FastAPI(title="Aurea Studio API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

llm = get_llm()


class ChatRequest(BaseModel):
    prompt: str


class ChatResponse(BaseModel):
    model: str
    response: str


@app.get("/health")
def health():
    return {"status": "ok", "model": MODEL_NAME}


@app.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    result = await llm.ainvoke(req.prompt)
    return ChatResponse(model=MODEL_NAME, response=result.content)

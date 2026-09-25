from langchain_ollama import ChatOllama

MODEL_NAME = "qwen3:8b"


def get_llm(temperature: float = 0.7, reasoning: bool = False) -> ChatOllama:
    """reasoning=False skips qwen3's <think> pass — much faster, and the
    agents here need reliable tool calls/JSON, not visible chain-of-thought."""
    return ChatOllama(model=MODEL_NAME, temperature=temperature, reasoning=reasoning)


if __name__ == "__main__":
    llm = get_llm()
    response = llm.invoke("Reply with exactly one word: hello")
    print(f"Model: {MODEL_NAME}")
    print(f"Response: {response.content}")

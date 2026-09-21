from langchain_ollama import ChatOllama

MODEL_NAME = "qwen3:8b"


def get_llm(temperature: float = 0.7) -> ChatOllama:
    return ChatOllama(model=MODEL_NAME, temperature=temperature)


if __name__ == "__main__":
    llm = get_llm()
    response = llm.invoke("Reply with exactly one word: hello")
    print(f"Model: {MODEL_NAME}")
    print(f"Response: {response.content}")

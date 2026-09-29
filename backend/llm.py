from langchain_core.exceptions import OutputParserException
from langchain_ollama import ChatOllama

MODEL_NAME = "qwen3:8b"


def get_llm(temperature: float = 0.7, reasoning: bool = False, max_tokens: int = 1000) -> ChatOllama:
    """reasoning=False skips qwen3's <think> pass — much faster, and the agents
    here need reliable JSON, not visible chain-of-thought. max_tokens caps output
    so a looping generation fails fast instead of running for minutes; keep_alive
    keeps the model loaded while the user reads (Ollama unloads after 5 min)."""
    return ChatOllama(
        model=MODEL_NAME,
        temperature=temperature,
        reasoning=reasoning,
        num_predict=max_tokens,
        keep_alive="30m",
    )


def invoke_structured(schema, prompt: str, *, temperature: float = 0.4, max_tokens: int = 1000):
    """One schema-constrained call, retried once if the output was cut off or unparseable."""
    llm = get_llm(temperature=temperature, max_tokens=max_tokens).with_structured_output(schema)
    try:
        return llm.invoke(prompt)
    except OutputParserException:
        return llm.invoke(prompt)


if __name__ == "__main__":
    llm = get_llm()
    response = llm.invoke("Reply with exactly one word: hello")
    print(f"Model: {MODEL_NAME}")
    print(f"Response: {response.content}")

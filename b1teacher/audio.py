"""Offline Spanish transcription and synthesis."""
import argparse
from functools import cached_property
from io import BytesIO
import os
from pathlib import Path
from tempfile import TemporaryDirectory
from threading import Lock
import wave

from .paths import DATA

MODELS = DATA / "models"
WHISPER = MODELS / "whisper-base"
VOICE = MODELS / "es_ES-sharvard-medium.onnx"
MAX_AUDIO = 6 * 1024 * 1024
MAX_SECONDS = 46


class AudioError(RuntimeError):
    pass


def models_ready():
    return all(path.is_file() and path.stat().st_size > 0 for path in (
        WHISPER / "model.bin", WHISPER / "config.json", WHISPER / "tokenizer.json",
        VOICE, VOICE.with_suffix(".onnx.json")
    ))


class LocalAudio:
    def __init__(self):
        self.transcribe_lock = Lock()
        self.speak_lock = Lock()

    @cached_property
    def recognizer(self):
        from faster_whisper import WhisperModel
        return WhisperModel(str(WHISPER), device="cpu", compute_type="int8", local_files_only=True)

    @cached_property
    def voice(self):
        from piper import PiperVoice
        return PiperVoice.load(VOICE)

    def transcribe(self, recording):
        from faster_whisper.audio import decode_audio
        if not models_ready():
            raise AudioError("Die Sprachmodelle fehlen. Führe zuerst setup.ps1 aus.")
        with self.transcribe_lock:
            try:
                audio = decode_audio(BytesIO(recording))
            except (ValueError, OSError, EOFError):
                raise AudioError("Diese Aufnahme konnte nicht gelesen werden.") from None
            if not len(audio) or len(audio) > 16000 * MAX_SECONDS:
                raise AudioError("Der Audioabschnitt ist leer oder zu lang.")
            segments, _ = self.recognizer.transcribe(
                audio, language="es", beam_size=3, vad_filter=True,
                condition_on_previous_text=False
            )
            return " ".join(segment.text.strip() for segment in segments).strip()

    def speak(self, text):
        from piper import SynthesisConfig
        if not models_ready():
            raise AudioError("Die Sprachmodelle fehlen. Führe zuerst setup.ps1 aus.")
        buffer = BytesIO()
        with self.speak_lock, wave.open(buffer, "wb") as output:
            self.voice.synthesize_wav(text, output, syn_config=SynthesisConfig(length_scale=1.13))
        return buffer.getvalue()


def prepare():
    MODELS.mkdir(parents=True, exist_ok=True)
    os.environ.setdefault("HF_HOME", str(MODELS / "cache"))
    os.environ.setdefault("HF_HUB_DISABLE_IMPLICIT_TOKEN", "1")
    from faster_whisper.utils import download_model
    from piper.download_voices import download_voice

    print("Lade das lokale Whisper-Modell …", flush=True)
    download_model("base", output_dir=str(WHISPER))
    if not all(file.is_file() and file.stat().st_size > 0 for file in (VOICE, VOICE.with_suffix(".onnx.json"))):
        print("Lade die spanische Stimme …", flush=True)
        with TemporaryDirectory(dir=MODELS) as directory:
            download_voice(VOICE.stem, Path(directory))
            for file in (VOICE, VOICE.with_suffix(".onnx.json")):
                os.replace(Path(directory) / file.name, file)
    if not models_ready():
        raise AudioError("Die Sprachmodelle konnten nicht vollständig geladen werden.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--prepare", required=True, action="store_true")
    parser.parse_args()
    prepare()

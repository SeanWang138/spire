#!/usr/bin/env python3
"""
SpireFi — International Hackathon Demo Video Master Pipeline.

1. Synthesizes 6 broadcast-grade English neural voice-over segments via `edge-tts`.
2. Measures exact segment durations and computes frame-accurate Act slots.
3. Synthesizes a procedural dark-fantasy harmonic ambient pad (`ambient.wav`).
4. Launches Playwright (`scripts/demo/record_scenes.mjs`) at 1920x1080.
5. Masters the final H.264 + AAC MP4 (`docs/demo/spirefi-hackathon-demo.mp4`)
   using `imageio_ffmpeg` (FFmpeg v9.0.2 full build).
"""

import asyncio
import json
import math
import os
import re
import struct
import subprocess
import sys
import wave
from pathlib import Path

import edge_tts
import imageio_ffmpeg

ROOT_DIR = Path(__file__).resolve().parents[2]
TMP_DIR = ROOT_DIR / "scripts" / "demo" / ".tmp"
OUT_DIR = ROOT_DIR / "docs" / "demo"
FINAL_MP4 = OUT_DIR / "spirefi-hackathon-demo.mp4"

VOICE = os.environ.get("DEMO_VOICE", "en-US-ChristopherNeural")
RATE = "+12%"
PITCH = "+0Hz"

ACTS = [
    {
        "id": "act1",
        "title": "Act I — Problem & 1-Click 0.60 NEAR Guest Onboarding",
        "text": (
            "On-chain RPGs usually break in two places: wallet popups scare players away, "
            "and static weapon metas drain the economy. "
            "Meet SpireFi on NEAR Testnet, where players enter the 3D Obsidian Citadel in one click "
            "with an auto-funded point-six NEAR guest session and silent gas tank."
        ),
        "pad_after_ms": 650,
    },
    {
        "id": "act2",
        "title": "Act II — 3-Floor Sanctum Raid & 13,500 bps Adaptive Resistance",
        "text": (
            "Inside the Sanctum Raid, boss resistances adapt to global weapon supply every hour "
            "without developer patches. "
            "Solar, Frost, and Void strictly conserve thirteen-thousand-five-hundred basis points, "
            "and over-stacking past seventy percent triggers Boss Tribute weapon confiscation."
        ),
        "pad_after_ms": 650,
    },
    {
        "id": "act3",
        "title": "Act III — Zero-Popup Combat & Supply-Driven Weapon Forge",
        "text": (
            "Every raid strike signs silently in the background. "
            "Entry tickets split transparently across the Floor Jackpot, Backer Vault, Weapon Buyback, and NPC Merchant. "
            "Forging or reforging Solar, Frost, and Void weapons immediately shifts next epoch's resistance."
        ),
        "pad_after_ms": 650,
    },
    {
        "id": "act4",
        "title": "Act IV — NPC Material Bazaar & Interactive Time-Warp Simulator",
        "text": (
            "Need crafting materials? The on-chain NPC Bazaar prices Iron Ore and Essences "
            "along a deterministic bonding curve around a one-hundred-unit equilibrium. "
            "Players can also drag the interactive Time-Warp Simulator to stress-test market depth and resistance shifts."
        ),
        "pad_after_ms": 650,
    },
    {
        "id": "act5",
        "title": "Act V — Backer Vault (15% Yield) & On-Chain NEP-171 SVG Trophy",
        "text": (
            "In the Treasury Vault, liquidity backers earn fifteen percent of every raid ticket "
            "via O-of-one dividend accounting across rounds. "
            "And conquering Floor Three mints a procedural NEP-171 Trophy NFT with its SVG artwork rendered completely on-chain."
        ),
        "pad_after_ms": 650,
    },
    {
        "id": "act6",
        "title": "Act VI — Deterministic Epoch Oracle & Call to Action",
        "text": (
            "Powered by a zero-AI-credit deterministic keeper and verified by fifty-five automated checks on spire-dot-testnet, "
            "SpireFi proves on-chain games on NEAR can run self-sustaining economies. "
            "Try the live Citadel today."
        ),
        "pad_after_ms": 1800,
    },
]


def get_duration_ms(ffmpeg_exe: str, media_path: Path) -> int:
    proc = subprocess.run(
        [ffmpeg_exe, "-i", str(media_path)],
        capture_output=True,
        text=True,
        check=False,
    )
    info = proc.stderr or ""
    m = re.search(r"Duration:\s*(\d+):(\d+):(\d+)\.(\d+)", info)
    if not m:
        raise RuntimeError(f"Could not parse duration from {media_path}:\n{info}")
    hh, mm, ss, frac = m.groups()
    frac_ms = int((frac + "000")[:3])
    return (int(hh) * 3600 + int(mm) * 60 + int(ss)) * 1000 + frac_ms


async def synthesize_voice_segments(ffmpeg_exe: str):
    TMP_DIR.mkdir(parents=True, exist_ok=True)
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    act_records = []
    for act in ACTS:
        mp3_path = TMP_DIR / f"{act['id']}.mp3"
        wav_path = TMP_DIR / f"{act['id']}.wav"
        print(f"[TTS] Synthesizing {act['id']} ({VOICE})...")
        comm = edge_tts.Communicate(act["text"], VOICE, rate=RATE, pitch=PITCH)
        await comm.save(str(mp3_path))

        # Convert to 44.1kHz stereo WAV and pad silence at end so each Act slot is self-contained
        pad_sec = act["pad_after_ms"] / 1000.0
        subprocess.run(
            [
                ffmpeg_exe,
                "-y",
                "-i",
                str(mp3_path),
                "-af",
                f"apad=pad_dur={pad_sec:.3f}",
                "-ar",
                "44100",
                "-ac",
                "2",
                str(wav_path),
            ],
            check=True,
            capture_output=True,
        )
        slot_ms = get_duration_ms(ffmpeg_exe, wav_path)
        print(f"      -> {act['id']} slot: {slot_ms / 1000:.2f}s")
        act_records.append(
            {
                "id": act["id"],
                "title": act["title"],
                "text": act["text"],
                "wavPath": str(wav_path),
                "SlotMs": slot_ms,
            }
        )

    # Concatenate all 6 padded WAVs into voiceover_master.wav
    concat_list = TMP_DIR / "vo_concat.txt"
    with open(concat_list, "w", encoding="utf-8") as f:
        for rec in act_records:
            safe_p = rec["wavPath"].replace("\\", "/")
            f.write(f"file '{safe_p}'\n")

    vo_master = TMP_DIR / "voiceover_master.wav"
    subprocess.run(
        [
            ffmpeg_exe,
            "-y",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            str(concat_list),
            "-c:a",
            "pcm_s16le",
            str(vo_master),
        ],
        check=True,
        capture_output=True,
    )
    total_ms = get_duration_ms(ffmpeg_exe, vo_master)
    print(f"[TTS] Master Voice-Over ready: {total_ms / 1000:.2f}s")

    timings_payload = {
        "voice": VOICE,
        "totalMs": total_ms,
        "acts": act_records,
    }
    with open(TMP_DIR / "timings.json", "w", encoding="utf-8") as f:
        json.dump(timings_payload, f, indent=2)

    return vo_master, total_ms, act_records


def generate_citadel_ambient_wav(wav_path: Path, duration_ms: int, act_records: list):
    """
    Generates a subtle, royalty-free D-minor dark-fantasy atmospheric synth pad
    with gentle harmonic shimmer on scene transitions.
    """
    sample_rate = 44100
    total_samples = int(sample_rate * (duration_ms / 1000.0))

    # D2 (73.42 Hz), A2 (110.0 Hz), D3 (146.83 Hz), F3 (174.61 Hz), A3 (220.0 Hz)
    freqs = [73.42, 110.00, 146.83, 174.61, 220.00]
    amps = [0.28, 0.24, 0.20, 0.14, 0.10]

    # Compute transition timestamps in seconds
    transition_times = [0.0]
    acc = 0.0
    for rec in act_records[:-1]:
        acc += rec["SlotMs"] / 1000.0
        transition_times.append(acc)

    fade_in_s = 1.2
    fade_out_s = 2.0
    total_s = duration_ms / 1000.0

    frames = bytearray()
    two_pi = 2.0 * math.pi

    for i in range(total_samples):
        t = i / sample_rate

        # Slow LFO breathing
        lfo = 0.82 + 0.18 * math.sin(two_pi * 0.14 * t)

        # Warm harmonic pad
        val = 0.0
        for f, a in zip(freqs, amps):
            val += a * math.sin(two_pi * f * t)

        # Subtle transition chime on each Act boundary (587.33 Hz D5 + 440 Hz A4)
        for tx in transition_times:
            dt = t - tx
            if 0.0 <= dt <= 1.1:
                env = math.exp(-3.8 * dt) * math.sin(math.pi * min(1.0, dt / 0.04))
                val += 0.22 * env * (
                    0.6 * math.sin(two_pi * 440.0 * t)
                    + 0.4 * math.sin(two_pi * 587.33 * t)
                )

        # Master envelope
        env_master = 1.0
        if t < fade_in_s:
            env_master = t / fade_in_s
        elif t > total_s - fade_out_s:
            env_master = max(0.0, (total_s - t) / fade_out_s)

        sample = max(-0.95, min(0.95, val * lfo * env_master * 0.35))
        s_int = int(sample * 32767)
        frames += struct.pack("<hh", s_int, s_int)

    with wave.open(str(wav_path), "wb") as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(frames)


def main():
    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
    print(f"[FFmpeg] Using binary: {ffmpeg_exe}")

    timings_file = TMP_DIR / "timings.json"
    vo_master = TMP_DIR / "voiceover_master.wav"
    if "--skip-tts" in sys.argv and timings_file.exists() and vo_master.exists():
        with open(timings_file, "r", encoding="utf-8") as f:
            t_data = json.load(f)
        total_vo_ms = t_data["totalMs"]
        act_records = t_data["acts"]
        print(f"[TTS] Reusing cached voice-over ({total_vo_ms / 1000:.2f}s)")
    else:
        vo_master, total_vo_ms, act_records = asyncio.run(
            synthesize_voice_segments(ffmpeg_exe)
        )

    ambient_wav = TMP_DIR / "ambient.wav"
    if not ("--skip-tts" in sys.argv and ambient_wav.exists()):
        print("[Audio] Generating procedural Obsidian Citadel ambient synth pad...")
        generate_citadel_ambient_wav(ambient_wav, total_vo_ms, act_records)

    print("[Playwright] Recording 1920x1080 live browser choreography across 6 Acts...")
    subprocess.run(
        ["node", str(ROOT_DIR / "scripts" / "demo" / "record_scenes.mjs")],
        cwd=str(ROOT_DIR),
        check=True,
    )

    rec_meta_path = TMP_DIR / "recorded_meta.json"
    with open(rec_meta_path, "r", encoding="utf-8") as f:
        rec_meta = json.load(f)

    raw_webm = Path(rec_meta["recordedPath"])
    raw_dur_ms = get_duration_ms(ffmpeg_exe, raw_webm)
    act_total_ms = sum(r["SlotMs"] for r in act_records)

    # Trim initial pre-warm offset so video frame 0 aligns with Act 1 voiceover start
    trim_start_sec = max(0.0, (raw_dur_ms - act_total_ms) / 1000.0 - 0.15)
    print(
        f"[Master] Raw video: {raw_dur_ms/1000:.2f}s | Act total: {act_total_ms/1000:.2f}s | Trim pre-warm: {trim_start_sec:.2f}s"
    )

    # Mix voice-over (foreground) + ambient pad (-16 dB background)
    mixed_audio = TMP_DIR / "master_audio.aac"
    subprocess.run(
        [
            ffmpeg_exe,
            "-y",
            "-i",
            str(vo_master),
            "-i",
            str(ambient_wav),
            "-filter_complex",
            "[0:a]volume=1.95[vo];[1:a]volume=0.22[amb];[vo][amb]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.95[aout]",
            "-map",
            "[aout]",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            str(mixed_audio),
        ],
        check=True,
        capture_output=True,
    )

    print(f"[Master] Encoding 1080p H.264 + AAC master to {FINAL_MP4}...")
    subprocess.run(
        [
            ffmpeg_exe,
            "-y",
            "-ss",
            f"{trim_start_sec:.3f}",
            "-i",
            str(raw_webm),
            "-i",
            str(mixed_audio),
            "-map",
            "0:v:0",
            "-map",
            "1:a:0",
            "-c:v",
            "libx264",
            "-preset",
            "slow",
            "-crf",
            "19",
            "-pix_fmt",
            "yuv420p",
            "-r",
            "30",
            "-c:a",
            "copy",
            "-movflags",
            "+faststart",
            "-shortest",
            str(FINAL_MP4),
        ],
        check=True,
        capture_output=True,
    )

    final_dur_ms = get_duration_ms(ffmpeg_exe, FINAL_MP4)
    size_mb = FINAL_MP4.stat().st_size / (1024 * 1024)
    print(
        f"[SUCCESS] Created {FINAL_MP4} ({final_dur_ms / 1000:.2f}s, {size_mb:.2f} MB)"
    )


if __name__ == "__main__":
    main()

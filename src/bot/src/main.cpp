#include <emscripten/emscripten.h>
#include <stdint.h>
#include "lantern.h"
#include <cstring>

Lantern engine;


extern "C" {
	bool is_ready() { return engine.is_ready; }
	uint8_t version() {
		uint8_t major_version = 1;
		uint8_t minor_version = 0;
		return (major_version << 4) | (minor_version & 0xf);
	}

	void set_board(const uint8_t board[Lantern::BOARD_SIZE][Lantern::BOARD_SIZE]) { engine.set_board(board); }
	const uint8_t* get_board() { return *engine.board; }

	uint16_t get_all_legal_moves(uint16_t* output) {
		Lantern::Move moves_output[Lantern::MAX_ALL_MOVES];
		uint16_t i = 0;
		uint16_t move_count = engine.get_all_legal_moves(engine.position, moves_output);
		while (i < move_count) {
			Lantern::Move move = moves_output[i];
			output[i] = static_cast<uint16_t>((engine.get_piece_coords(move.piece) << 8) | (move.x << 4) | move.y);
			i++;
		}
		return i;
	}
	bool apply_move(uint8_t from, uint8_t to) {
		uint8_t piece_index = engine.get_piece_index(from >> 4, from & 0xf);
		if (piece_index == 0xff) return false;
		return engine.apply_move(engine.position, piece_index, to >> 4, to & 0xf);
	}

	uint64_t get_best_move(uint16_t time_limit_ms) {
		Lantern::Move best_move;
		int16_t best_score = 0;
		uint8_t completed_depth = 0;
		const bool found_move = engine.find_best_move(engine.position, time_limit_ms, best_move, best_score, completed_depth);
		return
			(static_cast<uint64_t>(found_move) << 40) |
			(static_cast<uint64_t>(engine.get_piece_coords(best_move.piece)) << 32) |
			(static_cast<uint64_t>(best_move.x & 0xf) << 28) |
			(static_cast<uint64_t>(best_move.y & 0xf) << 24) |
			(static_cast<uint64_t>(static_cast<uint16_t>(best_score)) << 8) |
			completed_depth;
	}
}
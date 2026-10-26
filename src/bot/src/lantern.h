#pragma once
#include <stdint.h>

class Lantern {
    public:
        static constexpr uint8_t BOARD_SIZE = 10;
        static constexpr uint8_t PIECE_COUNT = 12;
        static constexpr uint8_t MOVE_LIMIT = 200;
        static constexpr uint8_t MAX_MOVES = 64;
        static constexpr uint16_t MAX_ALL_MOVES = PIECE_COUNT * MAX_MOVES;

        enum PieceType : uint8_t { EXPLORER = 0, VANGUARD = 1, SENTINEL = 2 };
        enum Color : uint8_t { RED = 0, BLUE = 1 };
        enum Winner : uint8_t { RED_WINNER = 0, BLUE_WINNER = 1, DRAW = 2 };
        enum DrawReason : uint8_t { THREEFOLD_REPETITION = 0, MOVE_LIMIT_DRAW = 1 };
        enum ResultReason : uint8_t { MOVE_LIMIT_SCORE = 0, MOVE_LIMIT_ADVANCEMENT = 1, TOTAL_DOMINATION = 2, PERFECT_GAME = 3 };

        struct Move {
            uint8_t piece;
            uint8_t x;
            uint8_t y;
            uint8_t cost;
            bool attack;
        };

        struct HistoryEntry {
            uint16_t pieces[PIECE_COUNT];
            uint16_t finished_pieces[2];
            uint8_t finished;
            uint8_t turn;
        };

        struct Position {
            uint32_t state;
            uint16_t pieces[PIECE_COUNT];
            HistoryEntry history[MOVE_LIMIT];
            uint8_t history_count;
            uint8_t finished_colors;
            uint8_t result_kind;
            uint16_t finished_pieces[2];
        };

        bool is_ready;
        uint8_t board[BOARD_SIZE][BOARD_SIZE];
        Position position;

        Lantern();
        void set_board(const uint8_t source[BOARD_SIZE][BOARD_SIZE]);
        void reset();
        uint8_t get_legal_moves(const Position& position, uint8_t piece_index, Move output[MAX_MOVES], bool ignore_turn = false) const;
        uint16_t get_all_legal_moves(const Position& position, Move output[MAX_ALL_MOVES]) const;
        bool apply_move(Position& position, uint8_t piece_index, uint8_t x, uint8_t y) const;
        int16_t evaluate_position(const Position& position) const;
        bool find_best_move(const Position& position, uint32_t time_limit_ms, Move& best_move, int16_t& best_score, uint8_t& completed_depth) const;
        uint8_t get_piece_index(uint8_t x, uint8_t y) const;
        uint8_t get_piece_coords(uint8_t piece_index) const;
        uint8_t get_piece_color(uint8_t piece_index) const;
        uint8_t get_current_turn();

    private:
        static constexpr uint32_t TURN_SHIFT = 31;
        static constexpr uint32_t MOVE_COUNT_SHIFT = 23;
        static constexpr uint32_t FINISHED_SHIFT = 19;
        static constexpr uint32_t FIRST_FINISH_SHIFT = 18;
        static constexpr uint32_t GAME_OVER_SHIFT = 17;
        static constexpr uint32_t WINNER_SHIFT = 15;
        static constexpr uint32_t SCORES_SHIFT = 11;
        static constexpr uint32_t DRAW_REASON_SHIFT = 10;
        static constexpr uint32_t RESULT_REASON_SHIFT = 8;
        static constexpr uint32_t EMPTY_PIECE = 0x0fff;

        static uint8_t type(uint16_t piece);
        static uint8_t color(uint16_t piece);
        static uint8_t x(uint16_t piece);
        static uint8_t y(uint16_t piece);
        static uint16_t make_piece(uint8_t type, uint8_t color, uint8_t x, uint8_t y);
        static bool active(uint16_t piece);
        static uint8_t current_turn(uint32_t state);
        static uint8_t move_count(uint32_t state);
        static uint8_t finished(uint32_t state, uint8_t slot);
        static uint8_t score(uint32_t state, uint8_t color);
        static void set_field(uint32_t& state, uint32_t mask, uint8_t shift, uint32_t value);
        static bool game_over(uint32_t state);
        static uint8_t winner(uint32_t state);
        static uint8_t result_reason(uint32_t state);
        static uint8_t piece_movement(uint8_t type);
        static uint8_t piece_strength(uint8_t type);

        void generate_pieces(Position& position) const;
        bool in_bounds(int x, int y) const;
        uint8_t movement_cost(uint8_t from_x, uint8_t from_y, uint8_t to_x, uint8_t to_y) const;
        int8_t find_piece(const Position& position, uint8_t x, uint8_t y) const;
        bool can_finish(uint8_t piece_color, uint8_t row) const;
        uint8_t adjacent_friendly_pieces(const Position& position, uint8_t piece_index) const;
        uint8_t adjacent_friendly_strength(const Position& position, uint8_t attacker, uint8_t defender) const;
        bool can_attack(const Position& position, uint8_t attacker, uint8_t defender, uint8_t cost) const;
        void resolve_move_limit(Position& position) const;
        void resolve_end_state(Position& position) const;
        void record_position(Position& position) const;
        bool is_threefold(const Position& position) const;
        uint8_t get_victory_type(const Position& position) const;
        void generate_board();
        struct SearchContext {
            uint64_t deadline;
            uint32_t nodes;
            bool stopped;
            uint8_t perspective;
            Move preferred;
            bool has_preferred;
        };
        static uint64_t now_ms();
        bool time_expired(SearchContext& context) const;
        int16_t evaluate_for(const Position& position, uint8_t perspective) const;
        int16_t search(const Position& position, uint8_t depth, int16_t alpha, int16_t beta, SearchContext& context) const;
        bool search_root(const Position& position, uint8_t depth, SearchContext& context, Move& best_move, int16_t& best_score) const;
};

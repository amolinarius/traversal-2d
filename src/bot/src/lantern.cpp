#include "lantern.h"
#include <algorithm>
#include <chrono>
#include <string.h>
#include <cstdlib>

#pragma region Static Engine

namespace {
    constexpr int8_t CARDINALS[4][2] = {{-1, 0}, {1, 0}, {0, -1}, {0, 1}};
    constexpr int8_t EXPLORER_DIRECTIONS[8][2] = {{-1, -1}, {-1, 1}, {1, -1}, {1, 1}, {-2, 0}, {0, -2}, {2, 0}, {0, 2}};
}
Lantern::Lantern() {
    generate_board();
    reset();
    is_ready = true;
}
void Lantern::generate_board() {
    memset(board, 0, sizeof(board));
}
void Lantern::set_board(const uint8_t source[BOARD_SIZE][BOARD_SIZE]) {
    memcpy(board, *source, sizeof(board));
    reset();
}
uint8_t Lantern::get_piece_index(uint8_t x, uint8_t y) const {
    uint8_t index = 0;
    for (uint16_t piece : position.pieces) {
        if (Lantern::x(piece) == x && Lantern::y(piece) == y) return index;
        index++;
    }
    return 0xff;
}
uint8_t Lantern::get_piece_coords(uint8_t piece_index) const {
    if (piece_index >= PIECE_COUNT) return 0xff;
    return (x(position.pieces[piece_index]) << 4) | y(position.pieces[piece_index]);
}
uint8_t Lantern::get_piece_color(uint8_t piece_index) const {
    if (piece_index >= PIECE_COUNT) return 0xff;
    return color(position.pieces[piece_index]);
}
uint8_t Lantern::get_current_turn() { return current_turn(position.state); }
void Lantern::reset() {
    memset(&position, 0, sizeof(position));
    position.state = 0;
    set_field(position.state, 3, FINISHED_SHIFT, 3);
    set_field(position.state, 3, FINISHED_SHIFT + 2, 3);
    generate_pieces(position);
    is_ready = true;
}
uint8_t Lantern::type(uint16_t piece) { return static_cast<uint8_t>((piece >> 10) & 3); }
uint8_t Lantern::color(uint16_t piece) { return static_cast<uint8_t>((piece >> 9) & 1); }
uint8_t Lantern::x(uint16_t piece) { return static_cast<uint8_t>((piece >> 4) & 15); }
uint8_t Lantern::y(uint16_t piece) { return static_cast<uint8_t>(piece & 15); }
uint16_t Lantern::make_piece(uint8_t piece_type, uint8_t piece_color, uint8_t piece_x, uint8_t piece_y) {
    return static_cast<uint16_t>(((piece_type & 3) << 10) | ((piece_color & 1) << 9) | ((piece_x & 15) << 4) | (piece_y & 15));
}
bool Lantern::active(uint16_t piece) { return piece != EMPTY_PIECE && x(piece) < BOARD_SIZE && y(piece) < BOARD_SIZE; }
uint8_t Lantern::current_turn(uint32_t state) { return static_cast<uint8_t>((state >> TURN_SHIFT) & 1); }
uint8_t Lantern::move_count(uint32_t state) { return static_cast<uint8_t>((state >> MOVE_COUNT_SHIFT) & 0xff); }
uint8_t Lantern::finished(uint32_t state, uint8_t slot) { return static_cast<uint8_t>((state >> (FINISHED_SHIFT + (slot ? 0 : 2))) & 3); }
uint8_t Lantern::score(uint32_t state, uint8_t piece_color) { return static_cast<uint8_t>((state >> (SCORES_SHIFT + (piece_color ? 0 : 2))) & 3); }
bool Lantern::game_over(uint32_t state) { return ((state >> GAME_OVER_SHIFT) & 1) != 0; }
uint8_t Lantern::winner(uint32_t state) { return static_cast<uint8_t>((state >> WINNER_SHIFT) & 3); }
uint8_t Lantern::result_reason(uint32_t state) { return static_cast<uint8_t>((state >> RESULT_REASON_SHIFT) & 3); }
void Lantern::set_field(uint32_t& state, uint32_t mask, uint8_t shift, uint32_t value) {
    state = (state & ~(mask << shift)) | ((value & mask) << shift);
}
uint8_t Lantern::piece_movement(uint8_t piece_type) { return piece_type == EXPLORER ? 5 : piece_type == VANGUARD ? 4 : 3; }
uint8_t Lantern::piece_strength(uint8_t piece_type) { return static_cast<uint8_t>(piece_type + 1); }

void Lantern::generate_pieces(Position& target) const {
    const uint8_t types[6] = {SENTINEL, VANGUARD, EXPLORER, EXPLORER, VANGUARD, SENTINEL};
    const uint8_t columns[6] = {2, 3, 4, 5, 6, 7};
    for (uint8_t i = 0; i < 6; ++i) {
        target.pieces[i] = make_piece(types[i], BLUE, columns[i], 0);
        target.pieces[i + 6] = make_piece(types[i], RED, columns[i], 9);
    }
    for (uint8_t i = 0; i < MOVE_LIMIT; ++i) target.history[i] = {};
    target.history_count = 0;
}
bool Lantern::in_bounds(int piece_x, int piece_y) const {
    return piece_x >= 0 && piece_x < BOARD_SIZE && piece_y >= 0 && piece_y < BOARD_SIZE;
}
uint8_t Lantern::movement_cost(uint8_t from_x, uint8_t from_y, uint8_t to_x, uint8_t to_y) const {
    const int difference = static_cast<int>(board[to_y][to_x]) - board[from_y][from_x];
    return difference == 0 ? 1 : static_cast<uint8_t>(std::abs(difference) + 1);
}
int8_t Lantern::find_piece(const Position& target, uint8_t piece_x, uint8_t piece_y) const {
    for (uint8_t i = 0; i < PIECE_COUNT; ++i)
        if (active(target.pieces[i]) && x(target.pieces[i]) == piece_x && y(target.pieces[i]) == piece_y) return static_cast<int8_t>(i);
    return -1;
}
bool Lantern::can_finish(uint8_t piece_color, uint8_t row) const {
    return piece_color == RED ? row == 0 : row == 9;
}
uint8_t Lantern::adjacent_friendly_pieces(const Position& target, uint8_t piece_index) const {
    const uint16_t piece = target.pieces[piece_index];
    uint8_t count = 0;
    for (const auto& direction : CARDINALS) {
        const int piece_x = x(piece) + direction[0], piece_y = y(piece) + direction[1];
        if (!in_bounds(piece_x, piece_y)) continue;
        const int8_t adjacent = find_piece(target, piece_x, piece_y);
        if (adjacent >= 0 && color(target.pieces[adjacent]) == color(piece) && adjacent != piece_index) ++count;
    }
    return count;
}
uint8_t Lantern::adjacent_friendly_strength(const Position& target, uint8_t attacker, uint8_t defender) const {
    const uint16_t attacking_piece = target.pieces[attacker], defending_piece = target.pieces[defender];
    uint8_t strength = 0;
    for (const auto& direction : CARDINALS) {
        const int piece_x = x(defending_piece) + direction[0], piece_y = y(defending_piece) + direction[1];
        if (!in_bounds(piece_x, piece_y)) continue;
        const int8_t adjacent = find_piece(target, piece_x, piece_y);
        if (adjacent >= 0 && adjacent != attacker && color(target.pieces[adjacent]) == color(attacking_piece))
            strength = static_cast<uint8_t>(strength + piece_strength(type(target.pieces[adjacent])));
    }
    return strength;
}
bool Lantern::can_attack(const Position& target, uint8_t attacker, uint8_t defender, uint8_t cost) const {
    const uint16_t attacking_piece = target.pieces[attacker], defending_piece = target.pieces[defender];
    int attacker_strength = piece_strength(type(attacking_piece)) + adjacent_friendly_strength(target, attacker, defender);
    const int height_difference = static_cast<int>(board[y(attacking_piece)][x(attacking_piece)]) - board[y(defending_piece)][x(defending_piece)];
    if (height_difference > 0) ++attacker_strength;
    if (height_difference < 0) --attacker_strength;
    if (type(attacking_piece) == VANGUARD && cost == 4) ++attacker_strength;
    const int defender_strength = piece_strength(type(defending_piece)) + adjacent_friendly_pieces(target, defender);
    return attacker_strength >= defender_strength;
}
uint8_t Lantern::get_legal_moves(const Position& target, uint8_t piece_index, Move output[MAX_MOVES], bool ignore_turn) const {
    if (piece_index >= PIECE_COUNT || !active(target.pieces[piece_index]) || (!ignore_turn && color(target.pieces[piece_index]) != current_turn(target.state))) return 0;
    const uint16_t piece = target.pieces[piece_index];
    const uint8_t piece_type = type(piece), piece_color = color(piece), movement = piece_movement(piece_type);
    uint8_t count = 0;
    int8_t remaining[BOARD_SIZE][BOARD_SIZE];
    for (uint8_t row = 0; row < BOARD_SIZE; ++row)
        for (uint8_t column = 0; column < BOARD_SIZE; ++column) remaining[row][column] = -1;
    bool reachable[BOARD_SIZE][BOARD_SIZE] = {};
    bool visited[BOARD_SIZE][BOARD_SIZE] = {};
    uint8_t queue_x[256], queue_y[256], queue_remaining[256];
    uint16_t head = 0, tail = 0;
    queue_x[tail] = x(piece); queue_y[tail] = y(piece); queue_remaining[tail++] = movement;
    remaining[y(piece)][x(piece)] = movement;
    reachable[y(piece)][x(piece)] = true;
    bool has_finish[BOARD_SIZE] = {};
    int8_t attack_target[BOARD_SIZE][BOARD_SIZE];
    uint8_t attack_cost[BOARD_SIZE][BOARD_SIZE] = {};
    for (uint8_t row = 0; row < BOARD_SIZE; ++row)
        for (uint8_t column = 0; column < BOARD_SIZE; ++column) attack_target[row][column] = -1;
    while (head < tail) {
        const uint8_t current_x = queue_x[head], current_y = queue_y[head], left = queue_remaining[head++];
        if (visited[current_y][current_x] && remaining[current_y][current_x] > left) continue;
        visited[current_y][current_x] = true;
        if (left >= 1 && (current_x != x(piece) || current_y != y(piece)) && can_finish(piece_color, current_y))
            has_finish[current_x] = true;
        for (const auto& direction : CARDINALS) {
            const int next_x = current_x + direction[0], next_y = current_y + direction[1];
            if (!in_bounds(next_x, next_y)) continue;
            const uint8_t cost = movement_cost(current_x, current_y, next_x, next_y);
            if (cost > left) continue;
            const int8_t occupying = find_piece(target, next_x, next_y);
            if (occupying >= 0) {
                if (color(target.pieces[occupying]) != piece_color) {
                    const uint8_t attack = static_cast<uint8_t>(movement - left + cost);
                    if (attack_target[next_y][next_x] < 0 || attack < attack_cost[next_y][next_x]) {
                        attack_target[next_y][next_x] = occupying;
                        attack_cost[next_y][next_x] = attack;
                    }
                }
                continue;
            }
            const uint8_t next_left = static_cast<uint8_t>(left - cost);
            if (next_left <= remaining[next_y][next_x]) continue;
            remaining[next_y][next_x] = next_left;
            reachable[next_y][next_x] = true;
            if (next_left > 0 && tail < 256) {
                queue_x[tail] = static_cast<uint8_t>(next_x); queue_y[tail] = static_cast<uint8_t>(next_y); queue_remaining[tail++] = next_left;
            }
        }
    }
    for (uint8_t row = 0; row < BOARD_SIZE; ++row)
        for (uint8_t column = 0; column < BOARD_SIZE; ++column)
            if (reachable[row][column] && (column != x(piece) || row != y(piece)) && count < MAX_MOVES)
                output[count++] = {piece_index, column, row, static_cast<uint8_t>(movement - remaining[row][column]), false};
    for (uint8_t column = 0; column < BOARD_SIZE; ++column)
        if (has_finish[column] && count < MAX_MOVES) output[count++] = {piece_index, column, static_cast<uint8_t>(piece_color == RED ? 0xff : 10), movement, false};
    for (const auto& direction : EXPLORER_DIRECTIONS) {
        const int next_x = x(piece) + direction[0], next_y = y(piece) + direction[1];
        if (std::abs(direction[0]) == 2 || std::abs(direction[1]) == 2) {
            if (!in_bounds(x(piece) + direction[0] / 2, y(piece) + direction[1] / 2) || find_piece(target, x(piece) + direction[0] / 2, y(piece) + direction[1] / 2) >= 0) continue;
        }
        if (next_y < 0 || next_y >= BOARD_SIZE) {
            if (next_x >= 0 && next_x < BOARD_SIZE && ((piece_color == RED && direction[1] < 0) || (piece_color == BLUE && direction[1] > 0)) && !has_finish[next_x] && count < MAX_MOVES) {
                has_finish[next_x] = true;
                output[count++] = {piece_index, static_cast<uint8_t>(next_x), static_cast<uint8_t>(piece_color == RED ? 0xff : 10), movement, false};
            }
            continue;
        }
        if (!in_bounds(next_x, next_y) || visited[next_y][next_x]) continue;
        const int8_t occupying = find_piece(target, next_x, next_y);
        if (occupying < 0 && count < MAX_MOVES) output[count++] = {piece_index, static_cast<uint8_t>(next_x), static_cast<uint8_t>(next_y), movement, false};
        else if (occupying >= 0 && attack_target[next_y][next_x] >= 0) continue;
        if (occupying >= 0 && color(target.pieces[occupying]) != piece_color && count < MAX_MOVES && can_attack(target, piece_index, static_cast<uint8_t>(occupying), movement))
            output[count++] = {piece_index, static_cast<uint8_t>(next_x), static_cast<uint8_t>(next_y), movement, true};
    }
    for (uint8_t row = 0; row < BOARD_SIZE; ++row)
        for (uint8_t column = 0; column < BOARD_SIZE; ++column)
            if (attack_target[row][column] >= 0 && count < MAX_MOVES &&
                can_attack(target, piece_index, static_cast<uint8_t>(attack_target[row][column]), attack_cost[row][column]))
                output[count++] = {piece_index, column, row, attack_cost[row][column], true};
    return count;
}

uint16_t Lantern::get_all_legal_moves(const Position& target, Move output[MAX_ALL_MOVES]) const {
    uint16_t count = 0;
    const uint8_t turn = current_turn(target.state);
    for (uint8_t piece_index = 0; piece_index < PIECE_COUNT; ++piece_index) {
        if (!active(target.pieces[piece_index]) || color(target.pieces[piece_index]) != turn) continue;
        Move moves[MAX_MOVES];
        const uint8_t move_count_value = get_legal_moves(target, piece_index, moves);
        for (uint8_t move_index = 0; move_index < move_count_value && count < MAX_ALL_MOVES; ++move_index)
            output[count++] = moves[move_index];
    }
    return count;
}
bool Lantern::apply_move(Position& target, uint8_t piece_index, uint8_t destination_x, uint8_t destination_y) const {
    Move moves[MAX_MOVES];
    const uint8_t move_count_value = get_legal_moves(target, piece_index, moves);
    const Move* selected = nullptr;
    for (uint8_t i = 0; i < move_count_value; ++i)
        if (moves[i].x == destination_x && moves[i].y == destination_y) { selected = &moves[i]; break; }
    if (!selected) return false;
    uint16_t piece = target.pieces[piece_index];
    const int8_t defender = find_piece(target, destination_x, destination_y);
    if (selected->attack && defender >= 0) target.pieces[defender] = EMPTY_PIECE;
    if (destination_y < BOARD_SIZE) target.pieces[piece_index] = make_piece(type(piece), color(piece), destination_x, destination_y);
    else {
        target.pieces[piece_index] = EMPTY_PIECE;
        const uint8_t slot = finished(target.state, 0) == 3 ? 0 : 1;
        const bool first_finished_piece = finished(target.state, slot) == 3;
        set_field(target.state, 3, static_cast<uint8_t>(FINISHED_SHIFT + (slot ? 0 : 2)), type(piece));
        target.finished_pieces[slot] = make_piece(type(piece), color(piece), destination_x, color(piece) == RED ? 0 : 9);
        if (slot) target.finished_colors = static_cast<uint8_t>((target.finished_colors & 1) | (color(piece) << 1));
        else target.finished_colors = static_cast<uint8_t>((target.finished_colors & 2) | color(piece));
        set_field(target.state, 3, SCORES_SHIFT + (color(piece) ? 0 : 2), score(target.state, color(piece)) + piece_strength(type(piece)));
        if (first_finished_piece) {
            set_field(target.state, 1, FIRST_FINISH_SHIFT, color(piece));
            if (type(piece) == SENTINEL) {
                set_field(target.state, 1, GAME_OVER_SHIFT, 1);
                set_field(target.state, 3, WINNER_SHIFT, color(piece));
            }
        }
    }
    resolve_end_state(target);
    set_field(target.state, 1, TURN_SHIFT, current_turn(target.state) ^ 1);
    set_field(target.state, 0xff, MOVE_COUNT_SHIFT, move_count(target.state) + 1);
    if (!game_over(target.state) && move_count(target.state) >= MOVE_LIMIT) resolve_move_limit(target);
    if (!game_over(target.state)) {
        record_position(target);
        if (is_threefold(target)) {
            set_field(target.state, 1, GAME_OVER_SHIFT, 1);
            set_field(target.state, 3, WINNER_SHIFT, DRAW);
            set_field(target.state, 1, DRAW_REASON_SHIFT, THREEFOLD_REPETITION);
            target.result_kind = 1;
        }
    }
    return true;
}
void Lantern::resolve_end_state(Position& target) const {
    const bool two_finished = finished(target.state, 0) != 3 && finished(target.state, 1) != 3;
    if (two_finished && !game_over(target.state)) {
        set_field(target.state, 1, GAME_OVER_SHIFT, 1);
        const uint8_t red_score = score(target.state, RED), blue_score = score(target.state, BLUE);
        set_field(target.state, 3, WINNER_SHIFT, red_score > blue_score ? RED_WINNER : blue_score > red_score ? BLUE_WINNER : DRAW);
    }
    if (!game_over(target.state)) {
        bool red_active = false, blue_active = false;
        uint8_t red_strength = 0, blue_strength = 0;
        for (uint8_t i = 0; i < PIECE_COUNT; ++i) {
            if (!active(target.pieces[i])) continue;
            if (color(target.pieces[i]) == RED) {
                red_active = true;
                red_strength = std::max(red_strength, piece_strength(type(target.pieces[i])));
            }
            else {
                blue_active = true;
                blue_strength = std::max(blue_strength, piece_strength(type(target.pieces[i])));
            }
        }
        if (!red_active || !blue_active) {
            set_field(target.state, 1, GAME_OVER_SHIFT, 1);
            set_field(target.state, 3, SCORES_SHIFT + 2, score(target.state, RED) + red_strength);
            set_field(target.state, 3, SCORES_SHIFT, score(target.state, BLUE) + blue_strength);
            const uint8_t red_score = score(target.state, RED), blue_score = score(target.state, BLUE);
            set_field(target.state, 3, WINNER_SHIFT, red_score > blue_score ? RED_WINNER : blue_score > red_score ? BLUE_WINNER : DRAW);
        }
    }
    if (game_over(target.state)) {
        const uint8_t victory = get_victory_type(target);
        if (victory != 0) {
            target.result_kind = 3;
            set_field(target.state, 3, RESULT_REASON_SHIFT, victory);
        }
    }
}
void Lantern::resolve_move_limit(Position& target) const {
    set_field(target.state, 1, GAME_OVER_SHIFT, 1);
    const uint8_t red_score = score(target.state, RED), blue_score = score(target.state, BLUE);
    if (red_score != blue_score) {
        set_field(target.state, 3, WINNER_SHIFT, red_score > blue_score ? RED_WINNER : BLUE_WINNER);
        set_field(target.state, 3, RESULT_REASON_SHIFT, MOVE_LIMIT_SCORE);
            target.result_kind = 2;
        return;
    }
    int red_advancement = 255, blue_advancement = 255;
    uint8_t red_strength = 0, blue_strength = 0;
    for (uint8_t i = 0; i < PIECE_COUNT; ++i) {
        if (!active(target.pieces[i])) continue;
        const uint8_t piece_color = color(target.pieces[i]);
        const int advancement = piece_color == RED ? y(target.pieces[i]) : 9 - y(target.pieces[i]);
        const uint8_t strength = piece_strength(type(target.pieces[i]));
        if (piece_color == RED && (advancement < red_advancement || (advancement == red_advancement && strength > red_strength))) {
            red_advancement = advancement; red_strength = strength;
        }
        if (piece_color == BLUE && (advancement < blue_advancement || (advancement == blue_advancement && strength > blue_strength))) {
            blue_advancement = advancement; blue_strength = strength;
        }
    }
    const uint8_t result = red_advancement < blue_advancement || (red_advancement == blue_advancement && red_strength > blue_strength)
        ? RED_WINNER
        : blue_advancement < red_advancement || (blue_advancement == red_advancement && blue_strength > red_strength)
            ? BLUE_WINNER : DRAW;
    set_field(target.state, 3, WINNER_SHIFT, result);
    if (result == DRAW) set_field(target.state, 1, DRAW_REASON_SHIFT, MOVE_LIMIT_DRAW);
    else {
        set_field(target.state, 3, RESULT_REASON_SHIFT, MOVE_LIMIT_ADVANCEMENT);
        target.result_kind = 2;
    }
}
void Lantern::record_position(Position& target) const {
    if (target.history_count >= MOVE_LIMIT) return;
    HistoryEntry& entry = target.history[target.history_count++];
    entry.turn = current_turn(target.state);
    entry.finished = static_cast<uint8_t>((finished(target.state, 0) << 2) | finished(target.state, 1));
    memcpy(entry.pieces, target.pieces, sizeof(entry.pieces));
    memcpy(entry.finished_pieces, target.finished_pieces, sizeof(entry.finished_pieces));
    std::sort(entry.pieces, entry.pieces + PIECE_COUNT);
}
bool Lantern::is_threefold(const Position& target) const {
    if (target.history_count < 3) return false;
    const HistoryEntry& recent = target.history[target.history_count - 1];
    uint8_t occurrences = 0;
    for (uint8_t i = 0; i < target.history_count; ++i) {
        const HistoryEntry& entry = target.history[i];
        if (entry.turn == recent.turn && entry.finished == recent.finished &&
            memcmp(entry.pieces, recent.pieces, sizeof(recent.pieces)) == 0 &&
            memcmp(entry.finished_pieces, recent.finished_pieces, sizeof(recent.finished_pieces)) == 0) ++occurrences;
    }
    return occurrences >= 3;
}
uint8_t Lantern::get_victory_type(const Position& target) const {
    const uint8_t current_winner = winner(target.state);
    if (current_winner != RED_WINNER && current_winner != BLUE_WINNER) return TOTAL_DOMINATION;
    const uint8_t losing_color = current_winner == RED_WINNER ? BLUE : RED;
    bool losing_active = false;
    for (uint8_t i = 0; i < PIECE_COUNT; ++i)
        if (active(target.pieces[i]) && color(target.pieces[i]) == losing_color) losing_active = true;
    if (!losing_active) return TOTAL_DOMINATION;
    bool winning_vanguard = false, winning_sentinel = false, losing_finished = false;
    for (uint8_t slot = 0; slot < 2; ++slot) {
        const uint8_t finished_type = finished(target.state, slot);
        if (finished_type == 3) continue;
        const uint8_t finished_color = static_cast<uint8_t>((target.finished_colors >> slot) & 1);
        if (finished_color == current_winner) {
            winning_vanguard |= finished_type == VANGUARD;
            winning_sentinel |= finished_type == SENTINEL;
        }
        else losing_finished = true;
    }
    if (!losing_finished && winning_vanguard && winning_sentinel) return PERFECT_GAME;
    if (!losing_active) return TOTAL_DOMINATION;
    return 0;
}

#pragma endregion

#pragma region Lantern

int16_t Lantern::evaluate_for(const Position& position, uint8_t evaluated_player) const {
    int16_t evaluation = 0;
    uint8_t index = 0;
    for (const uint16_t piece : position.pieces) {
        if (!active(piece)) {
            index++;
            continue;
        }
        const int16_t score_diff =
            10*piece_strength(type(piece)) +
            5*(color(piece) == RED ? 10-y(piece) : y(piece)) +
            2*(board[y(piece)][x(piece)]) +
            adjacent_friendly_pieces(position, index);
        if (color(piece) == evaluated_player) evaluation += score_diff;
        else evaluation -= score_diff;
        index++;
    }
    evaluation += static_cast<int16_t>(Lantern::score(position.state, evaluated_player)) * 4;
    evaluation -= static_cast<int16_t>(Lantern::score(position.state, evaluated_player ^ 1)) * 4;
    return evaluation;
}

int16_t Lantern::evaluate_position(const Position& position) const {
    return evaluate_for(position, current_turn(position.state));
}

uint64_t Lantern::now_ms() {
    return static_cast<uint64_t>(std::chrono::duration_cast<std::chrono::milliseconds>(
        std::chrono::steady_clock::now().time_since_epoch()).count());
}

bool Lantern::time_expired(SearchContext& context) const {
    if ((++context.nodes & 1023u) != 0) return false;
    if (now_ms() < context.deadline) return false;
    context.stopped = true;
    return true;
}

int16_t Lantern::search(const Position& position, uint8_t depth, int16_t alpha, int16_t beta, SearchContext& context) const {
    if (time_expired(context)) return 0;
    if (depth == 0 || game_over(position.state)) return evaluate_for(position, context.perspective);

    Move moves[MAX_ALL_MOVES];
    uint16_t move_count_value = 0;
    for (uint8_t piece_index = 0; piece_index < PIECE_COUNT; ++piece_index) {
        Move piece_moves[MAX_MOVES];
        const uint8_t count = get_legal_moves(position, piece_index, piece_moves);
        for (uint8_t i = 0; i < count && move_count_value < MAX_ALL_MOVES; ++i)
            moves[move_count_value++] = piece_moves[i];
    }
    if (move_count_value == 0) return evaluate_for(position, context.perspective);

    const bool maximizing = current_turn(position.state) == context.perspective;
    int16_t best = maximizing ? -32767 : 32767;
    for (uint16_t i = 0; i < move_count_value; ++i) {
        Position child = position;
        if (!apply_move(child, moves[i].piece, moves[i].x, moves[i].y)) continue;
        const int16_t value = search(child, static_cast<uint8_t>(depth - 1), alpha, beta, context);
        if (context.stopped) return 0;
        if (maximizing) {
            best = std::max(best, value);
            alpha = std::max(alpha, best);
        } else {
            best = std::min(best, value);
            beta = std::min(beta, best);
        }
        if (alpha >= beta) break;
    }
    return best;
}

bool Lantern::search_root(const Position& position, uint8_t depth, SearchContext& context, Move& best_move, int16_t& best_score) const {
    Move moves[MAX_ALL_MOVES];
    uint16_t move_count_value = 0;
    for (uint8_t piece_index = 0; piece_index < PIECE_COUNT; ++piece_index) {
        Move piece_moves[MAX_MOVES];
        const uint8_t count = get_legal_moves(position, piece_index, piece_moves);
        for (uint8_t i = 0; i < count && move_count_value < MAX_ALL_MOVES; ++i)
            moves[move_count_value++] = piece_moves[i];
    }
    if (move_count_value == 0) return false;
    if (context.has_preferred) {
        for (uint16_t i = 0; i < move_count_value; ++i) {
            if (moves[i].piece == context.preferred.piece && moves[i].x == context.preferred.x && moves[i].y == context.preferred.y) {
                std::swap(moves[0], moves[i]);
                break;
            }
        }
    }
    int16_t score_value = -32767;
    bool found = false;
    for (uint16_t i = 0; i < move_count_value; ++i) {
        if (time_expired(context)) return false;
        Position child = position;
        if (!apply_move(child, moves[i].piece, moves[i].x, moves[i].y)) continue;
        const int16_t value = search(child, static_cast<uint8_t>(depth - 1), -32767, 32767, context);
        if (context.stopped) return false;
        if (!found || value > score_value) {
            found = true;
            score_value = value;
            best_move = moves[i];
        }
    }
    if (found) best_score = score_value;
    return found;
}

bool Lantern::find_best_move(const Position& position, uint32_t time_limit_ms, Move& best_move, int16_t& best_score, uint8_t& completed_depth) const {
    if (time_limit_ms == 0 || game_over(position.state)) return false;
    SearchContext context{};
    context.deadline = now_ms() + time_limit_ms;
    context.perspective = current_turn(position.state);
    context.has_preferred = false;
    completed_depth = 0;
    for (uint8_t depth = 1; depth != 0; ++depth) {
        Move iteration_move{};
        int16_t iteration_score = 0;
        context.stopped = false;
        if (!search_root(position, depth, context, iteration_move, iteration_score)) break;
        best_move = iteration_move;
        best_score = iteration_score;
        completed_depth = depth;
        context.preferred = best_move;
        context.has_preferred = true;
    }
    return completed_depth > 0;
}

#pragma endregion
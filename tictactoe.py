#!/usr/bin/env python3
"""Простая игра Крестики-нолики для двух игроков."""

def print_board(board):
    """Вывод игрового поля."""
    print("\n  1   2   3")
    for i in range(3):
        row = [board[i][j] if board[i][j] != ' ' else str(j+1) for j in range(3)]
        print(f"{i+1}  {row[0]} | {row[1]} | {row[2]}")
        if i < 2:
            print("   ───┼───┼───")
    print()

def check_winner(board):
    """Проверка победителя."""
    # Горизонтали
    for i in range(3):
        if board[i][0] == board[i][1] == board[i][2] != ' ':
            return board[i][0]
    # Вертикали
    for i in range(3):
        if board[0][i] == board[1][i] == board[2][i] != ' ':
            return board[0][i]
    # Диагонали
    if board[0][0] == board[1][1] == board[2][2] != ' ':
        return board[1][1]
    if board[0][2] == board[1][1] == board[2][0] != ' ':
        return board[1][1]
    return None

def is_full(board):
    """Проверка на ничью."""
    return all(cell != ' ' for row in board for cell in row)

def main():
    """Основная игра."""
    board = [[' ' for _ in range(3)] for _ in range(3)]
    player = 'X'
    
    print("=" * 25)
    print("  КРЕСТИКИ-НОЛИКИ!")
    print("=" * 25)
    print("Ввод: строка_клетка (1-3)")
    print("Пример: 2_3")
    
    while True:
        print_board(board)
        
        winner = check_winner(board)
        if winner:
            print(f"\n🎉 Победил игрок {winner}!")
            break
        
        if is_full(board):
            print_board(board)
            print("\nНичья!")
            break
        
        # Ход игрока
        while True:
            try:
                move = input(f"\nХод игрока {player}: ").strip()
                row, col = map(int, move.split('_'))
                if 1 <= row <= 3 and 1 <= col <= 3:
                    if board[row-1][col-1] == ' ':
                        board[row-1][col-1] = player
                        break
                    print("❌ Клетка занята!")
                else:
                    print("❌ Введите числа 1-3")
            except ValueError:
                print("❌ Формат: 1_2 (строка_клетка)")
        
        player = 'O' if player == 'X' else 'X'

if __name__ == "__main__":
    main()

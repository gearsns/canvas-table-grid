import { createSignal, type Component } from "solid-js";
import { CanvasTableGrid, type GridStore, type DropdownOption } from "../src/index";

const INITIAL_ROWS = 20;
const initialData = Array.from({ length: INITIAL_ROWS }, (_, r) =>
  Array.from({ length: 26 }, (_, c) => {
    if (r === 0) return `項目${c + 1}`;
    // A列: 5行ごとに同じ日付にして、マージ風表示のデモが見えるようにする
    if (c === 0) return `2024-0${(Math.floor((r - 1) / 5) % 9) + 1}-01`;
    if (c === 1) return (r * 1234) % 987654;
    return null;
  })
);

// サーバーから関連データを取ってくる処理のダミー（実際は fetch() 等に置き換える）
function fetchRelatedValueFromServer(dateText: string): Promise<string> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const d = new Date(dateText);
      if (Number.isNaN(d.getTime())) {
        resolve("");
        return;
      }
      const youbi = ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];
      resolve(`${youbi}曜日`);
    }, 400); // ネットワーク遅延を模倣
  });
}

// C列（ステータス）用: サーバーから選択肢一覧を取ってくる処理のダミー
function fetchStatusOptionsFromServer(): Promise<DropdownOption[]> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve([
        { value: "todo", label: "未着手" },
        { value: "doing", label: "対応中" },
        { value: "review", label: "レビュー中" },
        { value: "done", label: "完了" },
        { value: "hold", label: "保留" },
      ]);
    }, 300); // ネットワーク遅延を模倣
  });
}

const App: Component = () => {
  let store: GridStore | undefined;
  const [status, setStatus] = createSignal("");
  const [readOnly, setReadOnly] = createSignal(false);

  return (
    <div style={{ display: "flex", "flex-direction": "column", height: "100%" }}>
      <div
        style={{
          display: "flex",
          gap: "8px",
          padding: "8px",
          "border-bottom": "1px solid #ddd",
          "align-items": "center",
        }}
      >
        <button onClick={() => store?.undo()}>元に戻す (Ctrl+Z)</button>
        <button onClick={() => store?.redo()}>やり直し (Ctrl+Y)</button>
        <span style={{ width: "1px", background: "#ddd", height: "20px" }} />
        <button
          onClick={() =>
            store && store.setRangeFormat(store.selection().range, { type: "number", pattern: "#,##0" })
          }
        >
          1,000 形式
        </button>
        <button
          onClick={() =>
            store &&
            store.setRangeFormat(store.selection().range, { type: "date", pattern: "M/D(ddd)" })
          }
        >
          9/1(月) 形式
        </button>
        <button
          onClick={() => store && store.setRangeFormat(store.selection().range, { color: "#d00000" })}
        >
          赤文字
        </button>
        <button
          onClick={() =>
            store && store.setRangeFormat(store.selection().range, { background: "#fff3cd" })
          }
        >
          黄背景
        </button>
        <button
          onClick={() =>
            store &&
            store.setRangeFormat(store.selection().range, { type: "text", background: undefined, color: undefined })
          }
        >
          書式クリア
        </button>
        <span style={{ width: "1px", background: "#ddd", height: "20px" }} />
        <label style={{ display: "flex", "align-items": "center", gap: "4px", "font-size": "13px" }}>
          <input type="checkbox" checked={readOnly()} onChange={(e) => setReadOnly(e.currentTarget.checked)} />
          読み取り専用
        </label>
        <span style={{ "margin-left": "auto", color: "#666", "font-size": "12px" }}>{status()}</span>
      </div>
      <div style={{ flex: "1", "min-height": "0" }}>
        <CanvasTableGrid
          options={{
            rows: INITIAL_ROWS,
            cols: 26,
            // 最終行に値を入れると、末尾に10行ずつ追加される
            autoAppendRows: 10,
            data: initialData as any,
            // 列ヘッダの名前をA,B,C...ではなく任意の名前にする例（配列で指定。範囲外はA,B,C…にフォールバック）
            columnHeaderLabel: ["日付", "曜日(自動補完)", "ステータス"],
          }}
          refStore={(s) => (store = s)}
          readOnly={readOnly()}
          onActiveCellChange={(r, c) => setStatus(`R${r + 1}C${c + 1} を選択中`)}
          // ショートカットキーの割り当てを一部だけ変更する例。
          // ここでは Ctrl+G を下方向コピー(fillDown)に割り当て直し、Ctrl+D は無効化している。
          keyBindings={{
            fillDown: [{ key: "g", mod: true }],
            // fillDown: null, // ← こう書けばショートカット自体を無効化できる
          }}
          onCellDoubleClick={({ row, col, value, displayValue }) => {
            setStatus(`ダブルクリック: R${row + 1}C${col + 1} 値=${JSON.stringify(value)} 表示=${displayValue}`);
            // false を返すと編集開始をキャンセルできる（例: ヘッダ行は編集させない）
            if (row === 0) return false;
          }}
          onRowsChange={(rows) => setStatus(`行数が ${rows} 行になりました`)}
          onBusyChange={(busy) => {
            if (busy) setStatus("処理中…（編集はロックされています）");
          }}
          // C列（col === 2, ヘッダ行を除く）だけドロップダウン編集に対応させる例。
          // 配列を返せば同期、Promiseを返せば非同期（サーバーから取得）に対応する。
          // それ以外のセルは undefined を返すことで通常のテキスト編集のままになる。
          dropdownOptions={(row, col) => {
            if (col !== 2 || row === 0) return undefined;
            return fetchStatusOptionsFromServer();
          }}
          // A列（日付）で、1つ上の行と同じ値なら「上の罫線を消す」+「文字色を薄くする」ことで
          // あたかもセル結合しているかのように見せる例。判定・見た目はすべてこちら側の制御。
          getCellFormat={(row, col, { value, getCell }) => {
            if (col !== 0 || row <= 1) return undefined;
            const above = getCell(row - 1, col);
            if (above !== null && above === value) {
              return { border: { top: false }, color: "#b0b0b0" };
            }
            return undefined;
          }}
          onChange={async (row, col, value, { mergeEdits }) => {
            // A列（col === 0, ヘッダ行(row===0)は除く）に日付を入れたら、
            // サーバーから関連値（ここでは曜日）を取得してB列(col 1)に自動補完する。
            // mergeEdits で渡した変更は、今回のユーザーの入力と同じUndo単位にまとまる。
            // → Ctrl+Z を1回押すだけで「入力した日付」と「補完されたB列の値」の両方が戻る。
            if (col !== 0 || row === 0) return;
            setStatus("関連データを取得中…");
            try {
              const related = await fetchRelatedValueFromServer(String(value ?? ""));
              if (!related) return;
              mergeEdits([{ row, col: 1, value: related }]);
              setStatus("補完しました");
            } catch {
              setStatus("取得に失敗しました");
            }
          }}
        />
      </div>
    </div>
  );
};

export default App;

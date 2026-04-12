次のバージョン番号を引数として受け取り、TimeRabbit-Jira のリリース手順を実行してください。

引数: $ARGUMENTS

## 手順

1. **バージョン番号の確認**
   - 引数が `vX.Y.Z` 形式であることを確認する（`v` プレフィックスがなければ補完する）
   - `package.json` と `manifest.json` の現在のバージョンを表示して確認を求める

2. **バージョン番号の更新**
   - `package.json` の `"version"` を新バージョンに更新
   - `manifest.json` の `"version"` を新バージョンに更新

3. **コミット**
   - `package.json` と `manifest.json` を add してコミット
   - コミットメッセージ: `Bump version to X.Y.Z`

4. **タグ付けと push**
   - `git tag vX.Y.Z`
   - `git push origin main --tags`

5. **GitHub リリースノートの作成**
   - `git log` で前バージョンタグからの差分コミットを確認する
   - 既存のリリースノート（`gh release view` で直前バージョンを参照）のフォーマットに倣って作成する
   - `gh release edit vX.Y.Z` でリリースノートを更新する
   - リリースノートのフォーマット:
     ```
     ## What's Changed

     ### 新機能
     ...

     ### バグ修正（あれば）
     ...

     ---

     **Full Changelog**: https://github.com/ITK13201/TimeRabbit-Jira/compare/vPREV...vNEW
     ```

各ステップの前にユーザーに確認を求めてから実行してください。

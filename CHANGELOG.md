# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/).

## Unreleased

### Added

### Changed

- update @tokyotower/factory

### Deprecated

### Removed

### Fixed

### Security

## v1.1.0 - 2019-07-29

### Added

- 売上集計ストリーミング検索を追加

## v1.0.1 - 2019-07-19

### Changed

- install @tokyotower/factory

## v1.0.0 - 2019-07-12

### Added

- タスクサービスを追加
- 注文取引検索を追加
- パフォーマンス拡張属性更新を追加
- 注文検索を追加
- 予約キャンセルを追加
- 予約印刷トークン発行を追加

### Changed

- update ttts-factory.
- パフォーマンスインターフェースをChevre化に向けて補強
- 予約検索条件を拡張
- 予約の入場以外の全属性をChevre化
- 券種インターフェースをChevre化
- パフォーマンス検索条件のChevre化

### Removed

- 券種からキャンセルチャージ属性を削除
- 注文取引結果からeventReservationsを削除(order.acceptedOffersへ移行)
- 仮予約インターフェースからrate_limit_unit_in_secondsを削除
- パフォーマンスインターフェースから非推奨属性を削除

## v0.0.2 - 2018-02-01
### Fixed
- 購入者情報登録のリクエストから国コードが除外されるバグを修正。

## v0.0.1 - 2018-01-21
### Fixed
- 管理者検索レスポンスの型を修正。

## v0.0.0 - 2018-01-17
### Added
- クライアント認証クライントを追加。
- OAuth2認証クライアントを追加。

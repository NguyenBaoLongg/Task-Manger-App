# Cách dùng năm skill module

## Điều phối toàn dự án

```text
$create-project-flexibly
Đọc trạng thái Spec Kit và tiếp tục module an toàn kế tiếp. Không bỏ qua dependency gate.
```

## 1. Kiến trúc và database

```text
$design-multitenant-architecture $speckit-specify
Tạo specification cho nền tảng multi-tenant, RBAC, dynamic forms, storage, realtime và push notification.
```

## 2. OKR và KPI

```text
$build-okr-kpi-engine $speckit-specify
Tạo specification cho alignment graph, KR tự động, check-in, evidence photo, perceptual hash và WAITING_PHOTOS.
```

## 3. Chấm công và workflow

```text
$build-timekeeping-workflows $speckit-specify
Tạo specification cho video check-in, penalty policy theo tenant, leave balance và approval routing động.
```

## 4. Booking và export

```text
$build-booking-export $speckit-specify
Tạo specification cho booking conflict trong một giờ, ARRIVED photo debt và export XLSX/PDF tenant-scoped.
```

## 5. Mobile

```text
$build-mobile-frontend $ui-ux-pro-max $design-system $speckit-plan
Lập kế hoạch mobile app cho OKR, Workspace, dynamic forms, calendar, chat, notification badges và quick actions.
```

## Chạy linh hoạt

- Prototype nhanh: gọi skill module cùng `$ui-ux-pro-max`, nhưng yêu cầu ghi rõ shortcut.
- Production: dùng đầy đủ Spec Kit quality gates.
- Nghiên cứu một subsystem từ đầu: thêm `$build-from-scratch-reference` ở bước plan.
- Chạy song song chỉ cho review độc lập sau khi spec/plan ổn định; không chạy các giai đoạn Spec Kit hoặc các module phụ thuộc nhau song song.

Sau khi thêm skill mới, mở task Codex mới hoặc khởi động lại ứng dụng nếu skill chưa hiện trong danh sách.

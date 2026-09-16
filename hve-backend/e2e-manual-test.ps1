$base = "http://localhost:3000"
$ErrorActionPreference = "Continue"

function Login($email, $pass) {
  $r = Invoke-RestMethod -Uri "$base/auth/login" -Method Post -ContentType "application/json" -Body (@{email=$email;password=$pass} | ConvertTo-Json)
  return $r.access_token
}
function AuthHeader($token) { return @{ Authorization = "Bearer $token" } }

Write-Host "=== LOGIN ALL USERS (spaced to respect 5 req/min throttle on /auth/login) ===" -ForegroundColor Cyan
$tCeo = Login "ceo@huyvoeducation.vn" "123456"
$tAdmin = Login "admin@huyvoeducation.vn" "123456"
$tTpIt = Login "tp_it@huyvoeducation.vn" "123456"
$tKetoan = Login "ketoan@huyvoeducation.vn" "123456"
$tPhapche = Login "phapche@huyvoeducation.vn" "123456"
Write-Host "  (5 logins done, waiting 62s for throttle window reset...)"
Start-Sleep -Seconds 62
$tNv1 = Login "nv1@huyvoeducation.vn" "123456"
$tTpKd = Login "tp_kd@huyvoeducation.vn" "123456"
$tNvKd1 = Login "nv_kd1@huyvoeducation.vn" "123456"
"CEO token: $($tCeo.Substring(0,20))..."
"nv1 token: $($tNv1.Substring(0,20))..."

Write-Host "`n=== FLOW 1: DE NGHI THANH TOAN (nv1 -> tp_it -> ketoan -> ceo) ===" -ForegroundColor Cyan
$dntt = Invoke-RestMethod -Uri "$base/documents/payment-requests" -Method Post -Headers (AuthHeader $tNv1) -ContentType "application/json" -Body (@{
  title = "Thanh toan hosting Q3/2026"
  amount = 15000000
  receiver = "Cong ty TNHH Hosting VN"
  bankName = "Vietcombank"
  bankAccount = "0071001234567"
  content = "Thanh toan phi hosting server 3 thang"
  deadline = "2026-10-15"
} | ConvertTo-Json)
"Created: $($dntt.code) (id=$($dntt.id), status=$($dntt.status))"

# attach dummy chung tu
$att1 = Invoke-RestMethod -Uri "$base/attachments/register" -Method Post -Headers (AuthHeader $tNv1) -ContentType "application/json" -Body (@{
  fileName = "hoa-don-hosting.pdf"
  mimeType = "application/pdf"
  size = 102400
  fileUrl = "/uploads/seed-hoa-don-hosting.pdf"
  entityType = "document"
  entityId = $dntt.id
} | ConvertTo-Json)
"Attached: $($att1.fileName)"

$submit1 = Invoke-RestMethod -Uri "$base/documents/$($dntt.id)/submit" -Method Post -Headers (AuthHeader $tNv1)
"Submitted, status=$($submit1.status), steps=$($submit1.steps.Count)"

$step1 = $submit1.steps | Where-Object { $_.status -eq 'pending' }
$appr1 = Invoke-RestMethod -Uri "$base/documents/$($dntt.id)/steps/$($step1.id)/approve" -Method Post -Headers (AuthHeader $tTpIt) -ContentType "application/json" -Body (@{comment="Dong y"} | ConvertTo-Json)
"tp_it approved -> status=$($appr1.status)"

$step2 = $appr1.steps | Where-Object { $_.status -eq 'pending' }
$appr2 = Invoke-RestMethod -Uri "$base/documents/$($dntt.id)/steps/$($step2.id)/approve" -Method Post -Headers (AuthHeader $tKetoan) -ContentType "application/json" -Body (@{comment="Da doi chieu hoa don"} | ConvertTo-Json)
"ketoan approved -> status=$($appr2.status)"

$step3 = $appr2.steps | Where-Object { $_.status -eq 'pending' }
$appr3 = Invoke-RestMethod -Uri "$base/documents/$($dntt.id)/steps/$($step3.id)/approve" -Method Post -Headers (AuthHeader $tCeo) -ContentType "application/json" -Body (@{comment="Duyet chi"} | ConvertTo-Json)
Write-Host "ceo approved -> FINAL status=$($appr3.status)" -ForegroundColor Green

Write-Host "`n=== NEGATIVE TEST: cross-department approval block ===" -ForegroundColor Cyan
try {
  # tao 1 dntt khac cua nv1 (IT), roi de tp_kd (KD) thu duyet -> phai bi 403
  $dntt2 = Invoke-RestMethod -Uri "$base/documents/payment-requests" -Method Post -Headers (AuthHeader $tNv1) -ContentType "application/json" -Body (@{
    title = "Test cross-dept block"; amount = 1000000; receiver = "Test"; bankName = "VCB"; bankAccount = "111"; content = "test"; deadline = "2026-12-01"
  } | ConvertTo-Json)
  Invoke-RestMethod -Uri "$base/attachments/register" -Method Post -Headers (AuthHeader $tNv1) -ContentType "application/json" -Body (@{fileName="x.pdf";mimeType="application/pdf";size=100;fileUrl="/uploads/x.pdf";entityType="document";entityId=$dntt2.id} | ConvertTo-Json) | Out-Null
  $sub2 = Invoke-RestMethod -Uri "$base/documents/$($dntt2.id)/submit" -Method Post -Headers (AuthHeader $tNv1)
  $st = $sub2.steps | Where-Object { $_.status -eq 'pending' }
  Invoke-RestMethod -Uri "$base/documents/$($dntt2.id)/steps/$($st.id)/approve" -Method Post -Headers (AuthHeader $tTpKd) -ContentType "application/json" -Body (@{comment="cross dept try"} | ConvertTo-Json)
  Write-Host "FAIL: cross-department approval was NOT blocked!" -ForegroundColor Red
} catch {
  Write-Host "PASS: cross-department approval correctly blocked -> $($_.Exception.Response.StatusCode)" -ForegroundColor Green
}

Write-Host "`n=== NEGATIVE TEST: employee cannot access /admin/users ===" -ForegroundColor Cyan
try {
  Invoke-RestMethod -Uri "$base/admin/users" -Headers (AuthHeader $tNv1)
  Write-Host "FAIL: employee accessed admin/users!" -ForegroundColor Red
} catch {
  Write-Host "PASS: blocked -> $($_.Exception.Response.StatusCode)" -ForegroundColor Green
}

Write-Host "`n=== FLOW 2: CONTRACT sap het han (nv1 -> tp_it -> phapche -> ketoan -> ceo) ===" -ForegroundColor Cyan
$endDate = (Get-Date).AddDays(10).ToString("yyyy-MM-dd")
$startDate = (Get-Date).AddDays(-350).ToString("yyyy-MM-dd")
$hd = Invoke-RestMethod -Uri "$base/documents/contracts" -Method Post -Headers (AuthHeader $tNv1) -ContentType "application/json" -Body (@{
  title = "Hop dong thue van phong 2026"
  partner = "Cong ty BDS ABC"
  value = 500000000
  startDate = $startDate
  endDate = $endDate
  manager = "Nhan vien 1"
  notes = "Gia han hang nam"
} | ConvertTo-Json)
"Created: $($hd.code)"
Invoke-RestMethod -Uri "$base/attachments/register" -Method Post -Headers (AuthHeader $tNv1) -ContentType "application/json" -Body (@{fileName="hop-dong.pdf";mimeType="application/pdf";size=204800;fileUrl="/uploads/seed-hop-dong.pdf";entityType="document";entityId=$hd.id} | ConvertTo-Json) | Out-Null
$subHd = Invoke-RestMethod -Uri "$base/documents/$($hd.id)/submit" -Method Post -Headers (AuthHeader $tNv1)
$s = $subHd.steps | Where-Object { $_.status -eq 'pending' }
$r1 = Invoke-RestMethod -Uri "$base/documents/$($hd.id)/steps/$($s.id)/approve" -Method Post -Headers (AuthHeader $tTpIt) -ContentType "application/json" -Body (@{comment="ok"} | ConvertTo-Json)
$s = $r1.steps | Where-Object { $_.status -eq 'pending' }
$r2 = Invoke-RestMethod -Uri "$base/documents/$($hd.id)/steps/$($s.id)/approve" -Method Post -Headers (AuthHeader $tPhapche) -ContentType "application/json" -Body (@{comment="dieu khoan on"} | ConvertTo-Json)
$s = $r2.steps | Where-Object { $_.status -eq 'pending' }
$r3 = Invoke-RestMethod -Uri "$base/documents/$($hd.id)/steps/$($s.id)/approve" -Method Post -Headers (AuthHeader $tKetoan) -ContentType "application/json" -Body (@{comment="ok"} | ConvertTo-Json)
$s = $r3.steps | Where-Object { $_.status -eq 'pending' }
$r4 = Invoke-RestMethod -Uri "$base/documents/$($hd.id)/steps/$($s.id)/approve" -Method Post -Headers (AuthHeader $tCeo) -ContentType "application/json" -Body (@{comment="duyet"} | ConvertTo-Json)
Write-Host "Contract final status=$($r4.status)" -ForegroundColor Green

$expiring = Invoke-RestMethod -Uri "$base/documents/contracts/expiring" -Headers (AuthHeader $tKetoan)
"Contracts expiring soon count: $($expiring.Count)"

Write-Host "`n=== FLOW 3a: TASK voi viec con (tp_it giao cho nv1, khong lap lai) ===" -ForegroundColor Cyan
$task = Invoke-RestMethod -Uri "$base/tasks" -Method Post -Headers (AuthHeader $tTpIt) -ContentType "application/json" -Body (@{
  title = "Hop tong ket thang"
  description = "Chuan bi va to chuc hop tong ket"
  assigneeId = 6
  priority = "normal"
  dueDate = (Get-Date).AddDays(7).ToString("yyyy-MM-dd")
} | ConvertTo-Json)
"Task created: $($task.code) (id=$($task.id))"

$sub1 = Invoke-RestMethod -Uri "$base/tasks" -Method Post -Headers (AuthHeader $tTpIt) -ContentType "application/json" -Body (@{
  title = "Chuan bi slide"; assigneeId = 6; priority = "normal"; dueDate = (Get-Date).AddDays(5).ToString("yyyy-MM-dd"); parentTaskId = $task.id
} | ConvertTo-Json)
$sub2 = Invoke-RestMethod -Uri "$base/tasks" -Method Post -Headers (AuthHeader $tTpIt) -ContentType "application/json" -Body (@{
  title = "Dat lich phong hop"; assigneeId = 6; priority = "normal"; dueDate = (Get-Date).AddDays(5).ToString("yyyy-MM-dd"); parentTaskId = $task.id
} | ConvertTo-Json)
"Subtasks: $($sub1.code), $($sub2.code)"

Invoke-RestMethod -Uri "$base/tasks/$($sub1.id)/progress" -Method Put -Headers (AuthHeader $tNv1) -ContentType "application/json" -Body (@{progressPercent=100} | ConvertTo-Json) | Out-Null
Invoke-RestMethod -Uri "$base/tasks/$($sub2.id)/progress" -Method Put -Headers (AuthHeader $tNv1) -ContentType "application/json" -Body (@{progressPercent=100} | ConvertTo-Json) | Out-Null
$parentCheck = Invoke-RestMethod -Uri "$base/tasks/$($task.id)" -Headers (AuthHeader $tTpIt)
"Parent auto progress=$($parentCheck.progressPercent)%, status=$($parentCheck.status)"

$done = Invoke-RestMethod -Uri "$base/tasks/$($task.id)/confirm-completion" -Method Post -Headers (AuthHeader $tTpIt)
"Confirmed done. status=$($done.task.status)"

Write-Host "Trying double-submit confirm-completion (should fail):" -NoNewline
try {
  Invoke-RestMethod -Uri "$base/tasks/$($task.id)/confirm-completion" -Method Post -Headers (AuthHeader $tTpIt)
  Write-Host " FAIL: allowed double confirm!" -ForegroundColor Red
} catch {
  Write-Host " PASS: blocked -> $($_.Exception.Response.StatusCode)" -ForegroundColor Green
}

Write-Host "`n=== FLOW 3b: TASK LAP LAI (doc lap, khong viec con) ===" -ForegroundColor Cyan
$rtask = Invoke-RestMethod -Uri "$base/tasks" -Method Post -Headers (AuthHeader $tTpIt) -ContentType "application/json" -Body (@{
  title = "Hop giao ban tuan"; assigneeId = 6; priority = "normal"; dueDate = (Get-Date).AddDays(3).ToString("yyyy-MM-dd"); recurrenceRule = "weekly"
} | ConvertTo-Json)
"Recurring task created: $($rtask.code), recurrenceRule=$($rtask.recurrenceRule)"
Invoke-RestMethod -Uri "$base/tasks/$($rtask.id)/progress" -Method Put -Headers (AuthHeader $tNv1) -ContentType "application/json" -Body (@{progressPercent=100} | ConvertTo-Json) | Out-Null
$rdone = Invoke-RestMethod -Uri "$base/tasks/$($rtask.id)/confirm-completion" -Method Post -Headers (AuthHeader $tTpIt)
"Confirmed. Next recurring task spawned: $($rdone.nextTask.code), due=$($rdone.nextTask.dueDate) (goc due=$($rtask.dueDate))"

Write-Host "`n=== REPORTS SCOPING CHECK ===" -ForegroundColor Cyan
$repEmployee = Invoke-RestMethod -Uri "$base/reports/summary" -Headers (AuthHeader $tNv1)
"nv1 (employee) sees documents.total = $($repEmployee.documents.total), contracts.total = $($repEmployee.contracts.total) (contracts phai la 0)"
$repDeptHead = Invoke-RestMethod -Uri "$base/reports/summary" -Headers (AuthHeader $tTpIt)
"tp_it (dept_head) sees documents.total = $($repDeptHead.documents.total)"
$repCeo = Invoke-RestMethod -Uri "$base/reports/summary" -Headers (AuthHeader $tCeo)
"ceo sees documents.total = $($repCeo.documents.total), contracts.total = $($repCeo.contracts.total)"

Write-Host "`n=== TRIGGER REMINDERS ===" -ForegroundColor Cyan
$rem = Invoke-RestMethod -Uri "$base/notifications/trigger-reminders" -Method Post -Headers (AuthHeader $tAdmin)
"Reminder trigger result: $($rem | ConvertTo-Json -Compress)"

Write-Host "`n=== NOTIFICATIONS CHECK (nv1) ===" -ForegroundColor Cyan
$notis = Invoke-RestMethod -Uri "$base/notifications" -Headers (AuthHeader $tNv1)
"nv1 has $($notis.Count) notifications, e.g: $($notis[0].title)"

Write-Host "`n=== VAPID PUBLIC KEY ENDPOINT ===" -ForegroundColor Cyan
$vapid = Invoke-RestMethod -Uri "$base/notifications/vapid-public-key" -Headers (AuthHeader $tNv1)
"publicKey length: $($vapid.publicKey.Length)"

Write-Host "`n=== ALL FLOWS COMPLETE ===" -ForegroundColor Cyan

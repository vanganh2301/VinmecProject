# PRODUCT REQUIREMENTS DOCUMENT (PRD)

## HỆ THỐNG DƯỢC BÁN LẺ -- VINMEC PHARMA (RETAIL POS)

> **Thông tin tài liệu**
>
>   Thuộc tính         Nội dung
>   ------------------ ---------------------------------------------
>   Tên sản phẩm       Vinmec Pharma (Retail POS)
>   Loại tài liệu      Product Requirements Document
>   Phiên bản          Draft v1.0
>   Đơn vị sử dụng     Nhà thuốc -- Khoa Dược Vinmec
>   Người dùng chính   Dược sĩ bán thuốc
>   Nền tảng           Web application, ưu tiên máy tính và tablet
>   Ngày lập           17/11/2026
>   Trạng thái         Bản dự thảo, chờ xác nhận nghiệp vụ

Tài liệu được xây dựng dựa trên yêu cầu nghiệp vụ được cung cấp và file
HTML `vinmec_retail_pharmacy(2).html`. File HTML là tài liệu tham chiếu
cho giao diện và luồng thao tác; các yêu cầu dưới đây không mặc định mọi
chức năng đã được triển khai hoàn chỉnh.

------------------------------------------------------------------------

## 1. Tổng quan dự án

### 1.1. Bối cảnh (Background)

Hiện tại, nhà thuốc Vinmec chưa có một hệ thống riêng để ghi nhận đầy đủ
lịch sử giao dịch bán thuốc cho khách mua lẻ phục vụ đối soát.

Trong quá trình bán hàng, dược sĩ có thể bán thuốc trực tiếp nhưng chưa
cập nhật ngay giao dịch vào SAP và OH. Khi lượng khách tăng cao hoặc có
nhiều giao dịch liên tiếp, việc ghi nhớ và nhập liệu bổ sung dễ bị bỏ
sót.

Khảo sát thực tế ghi nhận trường hợp nhân viên nhớ giá bán và bán thuốc
trực tiếp nhưng chưa nhập giao dịch trừ tồn. Đến kỳ kiểm kê, bộ phận
liên quan mới phải truy vết để xác định nguyên nhân chênh lệch.

Các vấn đề chính: - **Thiếu lịch sử giao dịch:** Khó xác định thuốc nào
đã bán, số lượng, thời gian và người thực hiện. - **Sai lệch tồn kho:**
Thuốc đã bán thực tế nhưng chưa được cập nhật trên SAP/OH. - **Tăng thời
gian đối soát:** Dược sĩ và quản lý phải kiểm tra, hỏi lại và xác minh
các giao dịch chưa được ghi nhận.

Trưởng khoa đề xuất xây dựng hệ thống ghi nhận hoạt động bán thuốc khách
mua lẻ nhằm hỗ trợ dược sĩ thao tác nhanh, lưu lịch sử và cung cấp dữ
liệu phục vụ cập nhật tồn kho.

### 1.2. Problem Statement

> Nhà thuốc chưa có công cụ tập trung để ghi nhận ngay các giao dịch bán
> thuốc cho khách mua lẻ. Việc bán hàng và cập nhật tồn kho trên SAP/OH
> không phải lúc nào cũng được thực hiện đồng thời, dẫn đến nguy cơ bỏ
> sót giao dịch và phát sinh chênh lệch khi kiểm kê.

### 1.3. Mục tiêu sản phẩm (Product Goals)

  -----------------------------------------------------------------------
  ID                      Mục tiêu                Kết quả mong đợi
  ----------------------- ----------------------- -----------------------
  G-01                    Số hóa hoạt động bán    Mỗi giao dịch được lưu
                          thuốc khách mua lẻ      với mã đơn riêng

  G-02                    Giảm thời gian thao tác Dược sĩ tìm và thêm
                          bán hàng                thuốc nhanh trên một
                                                  màn hình

  G-03                    Tăng khả năng truy vết  Xác định người bán,
                                                  thời gian, thuốc, số
                                                  lượng và giá

  G-04                    Hỗ trợ cập nhật SAP/OH  Xuất dữ liệu Excel có
                                                  cấu trúc phục vụ nhập
                                                  liệu, đối soát

  G-05                    Hạn chế bỏ sót giao     Có danh sách đơn đã bán
                          dịch                    và trạng thái xử lý

  G-06                    Hỗ trợ quản lý vận hành Thống kê lượt khách và
                                                  mặt hàng bán chạy

  G-07                    Giảm thao tác nhập liệu Hỗ trợ tìm kiếm gần
                                                  đúng và nhập liệu bằng
                                                  giọng nói
  -----------------------------------------------------------------------

### 1.4. Phạm vi sản phẩm (Scope)

**Trong phạm vi phát triển** - Đăng nhập và xác định dược sĩ thực hiện
giao dịch. - Tạo đơn bán thuốc với mã đơn tự động. - Tìm kiếm, chọn và
quản lý danh sách thuốc bán lẻ. - Quản lý giỏ hàng, đơn vị tính, số
lượng và giá bán. - Ghi nhận hàng hóa đặc biệt. - Thanh toán QR hoặc
tiền mặt. - Lưu và tra cứu lịch sử bán hàng. - Thống kê lượt khách và
mặt hàng bán chạy. - Nhập/xuất dữ liệu Excel. - Speech-to-text hỗ trợ
nhập đơn. - Hỗ trợ lưu tạm dữ liệu khi mất kết nối.

**Ngoài phạm vi MVP** - Xây dựng hệ thống ERP thay thế SAP. - Thay thế
toàn bộ nghiệp vụ của OH. - Kê đơn hoặc hỗ trợ chẩn đoán bệnh. - Bán
thuốc kê đơn thông qua chức năng POS khách mua lẻ. - AI tự động quyết
định thuốc phù hợp cho người bệnh. - Tự động đối soát ngân hàng hoặc ghi
dữ liệu trực tiếp vào SAP/OH nếu chưa có tích hợp được phê duyệt.

------------------------------------------------------------------------

## 2. Đối tượng sử dụng và phân quyền

### 2.1. User Roles

  -----------------------------------------------------------------------
  Vai trò                 Mô tả                   Quyền chính
  ----------------------- ----------------------- -----------------------
  Dược sĩ bán thuốc       Nhân viên trực tiếp     Tìm thuốc, tạo đơn,
                          thực hiện giao dịch     thanh toán, xem lịch sử
                                                  được cấp quyền

  Dược sĩ quản lý /       Người quản lý hoạt động Xem thống kê, kiểm tra
  Trưởng nhà thuốc        bán lẻ                  giao dịch, quản lý danh
                                                  mục theo phân quyền

  Quản trị hệ thống       Nhân sự quản lý tài     Quản lý tài khoản, phân
                          khoản và cấu hình       quyền, cấu hình hệ
                                                  thống
  -----------------------------------------------------------------------

### 2.2. User Stories

  -----------------------------------------------------------------------
  ID                                  User Story
  ----------------------------------- -----------------------------------
  US-01                               Là dược sĩ, tôi muốn đăng nhập bằng
                                      tài khoản riêng để giao dịch được
                                      ghi nhận đúng người bán.

  US-02                               Là dược sĩ, tôi muốn tìm thuốc
                                      nhanh dù gõ thiếu hoặc sai một vài
                                      ký tự để giảm thời gian phục vụ
                                      khách.

  US-03                               Là dược sĩ, tôi muốn thay đổi số
                                      lượng và đơn vị bán trực tiếp trong
                                      giỏ hàng để tránh thao tác nhiều
                                      bước.

  US-04                               Là dược sĩ, tôi muốn thanh toán
                                      bằng QR hoặc tiền mặt để đáp ứng
                                      nhu cầu khách hàng.

  US-05                               Là dược sĩ, tôi muốn xem lại lịch
                                      sử giao dịch để xác minh các thuốc
                                      đã bán.

  US-06                               Là người quản lý, tôi muốn thống kê
                                      thuốc bán chạy theo tuần hoặc tháng
                                      để đánh giá hoạt động nhà thuốc.

  US-07                               Là người quản lý, tôi muốn xuất
                                      giao dịch ra Excel để hỗ trợ cập
                                      nhật và đối soát SAP/OH.

  US-08                               Là dược sĩ, tôi muốn đọc tên thuốc
                                      và số lượng bằng giọng nói để giảm
                                      thao tác nhập liệu khi đông khách.
  -----------------------------------------------------------------------

------------------------------------------------------------------------

## 3. Quy trình nghiệp vụ đề xuất (TO-BE)

1.  **Đăng nhập:** Dược sĩ đăng nhập tài khoản được cấp.
2.  **Tạo đơn mới:** Hệ thống sinh mã đơn. Dược sĩ có thể nhập tên
    khách/PID hoặc bỏ qua.
3.  **Chọn mặt hàng:** Tìm kiếm thuốc, chọn đơn vị bán, nhập số lượng và
    thêm vào giỏ hàng.
4.  **Kiểm tra đơn:** Xác nhận mặt hàng, số lượng, giá bán và tổng tiền.
5.  **Thanh toán:** Chọn QR chuyển khoản hoặc tiền mặt.
6.  **Lưu giao dịch:** Sau xác nhận thanh toán hợp lệ, hệ thống ghi lịch
    sử bán hàng.
7.  **Đối soát:** Tra cứu và xuất Excel phục vụ cập nhật SAP/OH.

### Các quy tắc nghiệp vụ chung

-   Một đơn hàng có thể chứa nhiều loại thuốc hoặc hàng hóa.
-   Một đơn hàng phải có mã định danh duy nhất.
-   Tên khách hàng và PID không bắt buộc đối với khách mua lẻ, trừ khi
    nghiệp vụ yêu cầu khác.
-   Mỗi giao dịch phải liên kết với tài khoản dược sĩ thực hiện.
-   Tổng tiền được tính từ chi tiết từng mặt hàng.
-   Không được bán mặt hàng hết hạn, không thuộc danh mục cho phép hoặc
    không đủ tồn khả dụng.
-   Thanh toán thành công và cập nhật tồn kho SAP/OH là hai trạng thái
    độc lập.
-   Không được xóa mất lịch sử của giao dịch đã hoàn tất.

------------------------------------------------------------------------

## 4. Yêu cầu chức năng (Functional Requirements)

Mức độ ưu tiên: **P0 -- Bắt buộc cho MVP**, **P1 -- Nên có**, **P2 -- Mở
rộng**.

### 4.1. Module 1 -- Đăng nhập và quản lý phiên làm việc

*FR-AUTH -- Authentication & Session Management*

  -----------------------------------------------------------------------
  ID                      Yêu cầu                 Ưu tiên
  ----------------------- ----------------------- -----------------------
  FR-01                   Dược sĩ đăng nhập bằng  P0
                          tài khoản được cấp      

  FR-02                   Hệ thống xác định mã    P0
                          nhân viên và tên dược   
                          sĩ                      

  FR-03                   Hiển thị dược sĩ đang   P0
                          đăng nhập               

  FR-04                   Cho phép đăng xuất và   P0
                          chuyển tài khoản khi    
                          đổi ca                  

  FR-05                   Lưu đơn nháp khi chuyển P1
                          người dùng, có kiểm     
                          soát quyền truy cập     

  FR-06                   Phân quyền dược sĩ và   P1
                          quản lý nhà thuốc       
  -----------------------------------------------------------------------

**Business Rules** - BR-01: Mỗi giao dịch phải có `Seller ID` và
`Seller Name`. - BR-02: Người dùng chỉ được thực hiện chức năng theo
quyền được cấp. - BR-03: Chuyển tài khoản phải được xác thực lại. -
BR-04: Không cho phép sửa người bán của giao dịch đã hoàn tất nếu không
có quy trình điều chỉnh có lưu vết.

**Acceptance Criteria** - Khi dược sĩ đăng nhập thành công, hệ thống
hiển thị đúng tài khoản. - Khi tạo đơn mới, hệ thống tự gắn mã người
bán. - Sau khi chuyển tài khoản, giao dịch mới được ghi nhận dưới tài
khoản mới.

### 4.2. Module 2 -- Tạo và quản lý đơn bán

*FR-ORDER -- Retail Sales Order*

  ID      Yêu cầu                                           Ưu tiên
  ------- ------------------------------------------------- ---------
  FR-07   Sinh mã đơn hàng duy nhất khi tạo đơn mới         P0
  FR-08   Hiển thị mã đơn trên giao diện bán hàng           P0
  FR-09   Cho phép nhập tên khách hàng/PID không bắt buộc   P0
  FR-10   Thêm nhiều mặt hàng vào một đơn                   P0
  FR-11   Điều chỉnh số lượng, đơn vị tính trong giỏ hàng   P0
  FR-12   Tự động tính thành tiền và tổng tiền              P0
  FR-13   Cho phép xóa mặt hàng khỏi đơn nháp               P0
  FR-14   Lưu đơn nháp khi chưa hoàn tất                    P1
  FR-15   Sao chép mặt hàng từ đơn đã bán trước đó          P1
  FR-16   Ghi nhận hàng hóa đặc biệt và tên người bán       P0

**Cấu trúc thông tin đơn bán**

  Trường           Kiểu dữ liệu       Bắt buộc
  ---------------- ------------------ ----------------
  Order ID         String, duy nhất   Có
  Created At       Datetime           Có
  Seller ID        String             Có
  Customer Name    String             Không
  PID              String             Không
  Order Items      Array              Có
  Total Amount     Decimal            Có
  Payment Method   Enum               Khi thanh toán
  Order Status     Enum               Có

**Quy tắc tạo mã đơn**

Ví dụ: - `ORD-20261117-0001` - `ORD-20261117-0002`

Mã đơn không được trùng nhau, kể cả khi hai dược sĩ sử dụng hai thiết bị
cùng lúc. Với hệ thống thật, mã phải được cấp hoặc xác nhận bởi cơ chế
định danh tập trung; số thứ tự lưu riêng trên trình duyệt không đủ bảo
đảm duy nhất.

**Order Status đề xuất**

  Trạng thái               Ý nghĩa
  ------------------------ ------------------------
  Draft                    Đang tạo đơn
  Pending Payment          Đang chờ thanh toán
  Paid                     Đã xác nhận thanh toán
  Cancelled                Đơn bị hủy
  Pending Reconciliation   Đã bán, chờ đối soát

### 4.3. Module 3 -- Tìm kiếm và quản lý danh mục thuốc

*FR-PRODUCT -- Product Search & Catalog Management*

Phạm vi danh mục: - Thuốc không kê đơn (OTC). - Thực phẩm chức năng. -
Vật tư y tế.

Không bao gồm thuốc kê đơn trong luồng POS này.

  ID      Yêu cầu                                              Ưu tiên
  ------- ---------------------------------------------------- ---------
  FR-17   Tìm kiếm theo tên thuốc                              P0
  FR-18   Tìm kiếm theo mã thuốc                               P0
  FR-19   Áp dụng thuật toán Fuzzy Search                      P0
  FR-20   Hiển thị hình ảnh mặt hàng                           P1
  FR-21   Hiển thị mã, tên, kho, ĐVT, giá, tồn, hạn dùng       P0
  FR-22   Lọc theo nhóm hàng OTC/TPCN/vật tư                   P0
  FR-23   Thêm mặt hàng vào danh mục                           P0
  FR-24   Chỉnh sửa thông tin và giá bán                       P0
  FR-25   Ngừng bán/ẩn mặt hàng khỏi danh mục đang hoạt động   P0
  FR-26   Nhập danh mục từ Excel                               P1
  FR-27   Cập nhật hàng loạt theo mã thuốc                     P1
  FR-28   Cảnh báo mặt hàng hết hàng hoặc hết hạn              P0

**Thông tin mặt hàng**

  Field            Mô tả
  ---------------- ----------------------------
  Product Code     Mã thuốc/mã sản phẩm
  Product Name     Tên thuốc/hàng hóa
  Product Image    Hình ảnh sản phẩm
  Category         OTC/TPCN/vật tư y tế
  Warehouse        Kho chứa
  Unit             Đơn vị tính
  Price            Giá bán
  Stock Quantity   Tồn khả dụng
  Expiry Date      Hạn sử dụng
  LOT              Số lô, bổ sung để truy vết

**Fuzzy Search**

Hệ thống hỗ trợ tìm kiếm gần đúng khi người dùng nhập thiếu, không dấu
hoặc sai một số ký tự.

  Từ khóa         Kết quả mong đợi
  --------------- --------------------------------
  `paracetamol`   Paracetamol 500mg
  `paracatamol`   Gợi ý Paracetamol
  `vitamin c`     Các sản phẩm Vitamin C phù hợp
  `SAP001`        Mặt hàng có mã SAP001

Kết quả cần được xếp hạng theo mức độ phù hợp. Khi có nhiều thuốc tên
gần giống nhau nhưng khác hàm lượng, dạng bào chế hoặc mã, hệ thống phải
hiển thị riêng từng mặt hàng để dược sĩ lựa chọn.

**Business Rules** - BR-05: Chỉ mặt hàng thuộc danh mục được phép bán lẻ
mới được hiển thị trong màn hình bán. - BR-06: Không cho phép bán mặt
hàng hết hạn hoặc hết tồn khả dụng. - BR-07: Giá bán mặc định được lấy
từ danh mục giá. - BR-08: Việc sửa giá phải được phân quyền và lưu lịch
sử chỉnh sửa. - BR-09: Nhập Excel trùng mã thuốc phải qua kiểm tra hợp
lệ trước khi cập nhật dữ liệu. - BR-10: Không xóa vật lý mặt hàng đã
xuất hiện trong giao dịch lịch sử; sử dụng trạng thái ngừng kinh
doanh. - BR-11: Với nhiều LOT, hệ thống phải xác định đúng lô và số
lượng xuất bán.

### 4.4. Module 4 -- Quản lý giỏ hàng và số lượng

*FR-CART -- Cart & Quantity Management*

  ID      Yêu cầu                                 Ưu tiên
  ------- --------------------------------------- ---------
  FR-29   Thêm thuốc vào giỏ hàng                 P0
  FR-30   Tăng/giảm số lượng bằng nút chạm        P0
  FR-31   Chỉnh sửa số lượng trực tiếp            P0
  FR-32   Chọn đơn vị tính được phép bán          P0
  FR-33   Tự động tính lại thành tiền             P0
  FR-34   Xóa mặt hàng khỏi giỏ                   P0
  FR-35   Hiển thị tổng số lượng và tổng tiền     P0
  FR-36   Kiểm tra tồn kho trước khi thanh toán   P0

**Quy tắc tính tiền** - Thành tiền = Số lượng bán × Đơn giá. - Tổng đơn
= Tổng thành tiền của tất cả mặt hàng.

Trường hợp bán theo nhiều đơn vị như viên, vỉ, hộp hoặc chai phải có
bảng quy đổi được cấu hình. Không mặc định giá một hộp bằng giá một viên
hoặc sử dụng chung một số lượng tồn cho mọi đơn vị.

**Acceptance Criteria** - Khi tăng số lượng, thành tiền cập nhật ngay. -
Khi xóa mặt hàng, tổng đơn được tính lại. - Số lượng không thể là số âm
hoặc bằng 0. - Đơn không thể thanh toán nếu không có mặt hàng. - Nếu số
lượng vượt tồn khả dụng, hệ thống hiển thị cảnh báo tại dòng mặt hàng,
không cần popup chặn toàn màn hình.

### 4.5. Module 5 -- Thanh toán

*FR-PAYMENT -- QR & Cash Payment*

  ID      Yêu cầu                                  Ưu tiên
  ------- ---------------------------------------- ---------
  FR-37   Chọn phương thức thanh toán QR           P0
  FR-38   Sinh QR có số tiền cần chuyển            P0
  FR-39   Hiển thị thông tin tài khoản nhận tiền   P0
  FR-40   Gắn mã đơn vào nội dung chuyển khoản     P0
  FR-41   Hỗ trợ thanh toán tiền mặt               P0
  FR-42   Xác nhận giao dịch đã thanh toán         P0
  FR-43   Ghi nhận hình thức thanh toán            P0
  FR-44   Lưu tham chiếu thanh toán nếu có         P1

**Luồng QR:** Dược sĩ chọn QR → hệ thống hiển thị mã và số tiền → khách
chuyển khoản → xác minh thanh toán → xác nhận giao dịch → lưu lịch sử.

**Luồng tiền mặt:** Dược sĩ chọn Tiền mặt → nhận đủ tiền → xác nhận →
hoàn tất giao dịch → lưu lịch sử.

**Business Rules** - BR-12: Số tiền QR phải khớp tổng đơn hàng tại thời
điểm thanh toán. - BR-13: Mã đơn được đưa vào thông tin tham chiếu thanh
toán. - BR-14: QR chưa được xác minh không tự động đồng nghĩa với thanh
toán thành công. - BR-15: Chỉ ghi nhận trạng thái Paid sau khi có xác
nhận hợp lệ. - BR-16: Không tự động tạo giao dịch trùng khi người dùng
nhấn xác nhận nhiều lần.

### 4.6. Module 6 -- Lịch sử bán thuốc

*FR-HISTORY -- Retail Sales History*

  ID      Yêu cầu                                   Ưu tiên
  ------- ----------------------------------------- ---------
  FR-45   Tự động lưu giao dịch sau thanh toán      P0
  FR-46   Tra cứu theo mã đơn                       P0
  FR-47   Tra cứu theo tên/mã thuốc                 P0
  FR-48   Tra cứu theo người bán                    P0
  FR-49   Lọc theo ngày hoặc khoảng thời gian       P0
  FR-50   Xem chi tiết từng giao dịch               P0
  FR-51   Hiển thị số lượng, giá và thời gian mua   P0
  FR-52   Ghi nhận trạng thái xử lý SAP/OH          P1
  FR-53   Ghi nhận lịch sử thay đổi giao dịch       P1

**Thông tin phải lưu trong lịch sử**

  Nhóm         Trường dữ liệu
  ------------ --------------------------------------------------
  Giao dịch    Mã đơn, thời gian tạo, thời gian hoàn tất
  Người bán    Seller ID, Seller Name
  Khách hàng   Customer Name, PID (nếu có)
  Mặt hàng     Product Code, Product Name, Warehouse, Unit, LOT
  Bán hàng     Quantity, Unit Price, Line Total
  Thanh toán   Payment Method, Payment Status, Total Amount
  Đối soát     SAP Status, OH Status (nếu triển khai)

Một đơn hàng nhiều loại thuốc phải lưu được từng dòng mặt hàng riêng
biệt, không chỉ lưu tổng số loại thuốc.

### 4.7. Module 7 -- Thống kê và báo cáo

*FR-REPORT -- Sales Analytics*

  ID      Yêu cầu                                    Ưu tiên
  ------- ------------------------------------------ ---------
  FR-54   Biểu đồ số lượt khách mua lẻ theo giờ      P0
  FR-55   Thống kê số giao dịch theo ngày            P0
  FR-56   Thống kê mặt hàng bán chạy theo tuần       P0
  FR-57   Thống kê mặt hàng bán chạy theo tháng      P0
  FR-58   Thống kê số lượng bán theo từng mặt hàng   P0
  FR-59   Thống kê doanh thu bán lẻ                  P1
  FR-60   Lọc báo cáo theo thời gian                 P0

**Quy tắc thống kê** - Số lượt khách mua lẻ trong MVP được tính theo số
đơn bán hoàn tất, không phải số người duy nhất. - Một đơn gồm nhiều mặt
hàng vẫn được tính là một lượt giao dịch. - Đơn nháp và đơn hủy không
được tính vào lượt mua thành công. - Mặt hàng bán chạy được xác định
theo tổng số lượng đã bán trong kỳ, với đơn vị tính được chuẩn hóa. -
Doanh thu được tính từ những giao dịch đủ điều kiện theo chính sách báo
cáo.

### 4.8. Module 8 -- Speech-to-text

*FR-VOICE -- Voice-assisted Order Entry*

  -----------------------------------------------------------------------
  ID                      Yêu cầu                 Ưu tiên
  ----------------------- ----------------------- -----------------------
  FR-61                   Dược sĩ kích hoạt       P1
                          microphone              

  FR-62                   Chuyển giọng nói tiếng  P1
                          Việt thành văn bản      

  FR-63                   Trích xuất tên thuốc và P1
                          số lượng                

  FR-64                   Đối chiếu mặt hàng với  P1
                          danh mục                

  FR-65                   Hiển thị đề xuất để     P0 nếu triển khai voice
                          dược sĩ xác nhận        

  FR-66                   Thêm mặt hàng đã xác    P1
                          nhận vào giỏ            

  FR-67                   Ghi nhật ký thao tác    P1
                          giọng nói               
  -----------------------------------------------------------------------

**Ví dụ**

Input: "Paracetamol 500mg, hai hộp."

  Field              Value
  ------------------ -----------------------------------
  Product Name       Paracetamol 500mg
  Quantity           2
  Unit               Hộp
  Matching Product   Mã thuốc tương ứng trong danh mục
  Confirmation       Chờ dược sĩ xác nhận

Speech-to-text chỉ được sử dụng để hỗ trợ nhập liệu. Nếu hệ thống không
nhận dạng chính xác tên hoặc hàm lượng, không được tự động lựa chọn một
thuốc khác chỉ vì tên gần giống.

### 4.9. Module 9 -- Nhập và xuất Excel

*FR-EXCEL -- Import & Export*

  -----------------------------------------------------------------------
  ID                      Yêu cầu                 Ưu tiên
  ----------------------- ----------------------- -----------------------
  FR-68                   Nhập danh mục thuốc     P1
                          bằng Excel              

  FR-69                   Kiểm tra dữ liệu trước  P0 nếu triển khai
                          khi cập nhật            import

  FR-70                   Cập nhật giá theo mã    P1
                          thuốc                   

  FR-71                   Xuất lịch sử bán thuốc  P0
                          ra Excel                

  FR-72                   Xuất chi tiết từng mặt  P0
                          hàng đã bán             

  FR-73                   Lọc dữ liệu trước khi   P1
                          xuất                    

  FR-74                   Xuất riêng giao dịch    P1
                          chưa đối soát SAP/OH    
  -----------------------------------------------------------------------

**Đề xuất cấu trúc file Excel đầu ra** - **Sheet 1 -- Sales Summary:**
mã đơn, thời gian, người bán, khách hàng, PID, hình thức thanh toán,
tổng tiền, trạng thái. - **Sheet 2 -- Sales Details:** mã đơn, mã thuốc,
tên thuốc, kho, LOT, ĐVT, số lượng, giá bán, thành tiền. - **Sheet 3 --
Reconciliation:** các dòng giao dịch cần xử lý trên SAP/OH, kèm trạng
thái và tham chiếu đã xử lý.

Định dạng Excel phục vụ SAP/OH phải được xác nhận với đơn vị quản lý các
hệ thống hiện tại. Không thể mặc định file xuất lịch sử bán hàng sẽ sử
dụng trực tiếp được làm file nhập SAP/OH.

------------------------------------------------------------------------

## 5. Yêu cầu giao diện và trải nghiệm người dùng (UI/UX Requirements)

### 5.1. Nguyên tắc thiết kế

Hệ thống được thiết kế theo hướng **Tablet-first, Master--Detail
Layout**, đồng thời hỗ trợ máy tính tại quầy thuốc.

  -----------------------------------------------------------------------
  Khu vực                             Nội dung
  ----------------------------------- -----------------------------------
  Cột trái                            Thông tin khách hàng, PID, sao chép
                                      đơn cũ, nhập liệu bằng giọng nói

  Cột giữa                            Tìm kiếm thuốc, lọc nhóm hàng, danh
                                      sách sản phẩm

  Cột phải                            Giỏ hàng, số lượng, đơn giá, tổng
                                      tiền, thanh toán
  -----------------------------------------------------------------------

**Yêu cầu UI** - Các nút thao tác chính có vùng chạm tối thiểu 48 × 48
dp. - Không yêu cầu chuyển màn hình để chỉnh sửa giỏ hàng hoặc thanh
toán thông thường. - Ưu tiên hiển thị tên thuốc, hàm lượng, giá, tồn kho
và hạn sử dụng. - Phân loại nhóm hàng bằng màu sắc nhất quán: xanh lá
cho OTC, cam cho TPCN, tím cho vật tư y tế. - Sử dụng cảnh báo tại vị
trí phát sinh lỗi thay vì nhiều hộp thoại. - Hiển thị trạng thái mạng
bằng biểu tượng nhỏ, không gây gián đoạn. - Chức năng quản lý danh mục
và báo cáo đặt tại tab riêng để không làm rối màn hình bán hàng.

### 5.2. Danh sách màn hình

  -----------------------------------------------------------------------
  Screen ID               Tên màn hình            Chức năng chính
  ----------------------- ----------------------- -----------------------
  SCR-01                  Login                   Đăng nhập dược sĩ

  SCR-02                  Retail POS              Tạo đơn, tìm thuốc,
                                                  quản lý giỏ hàng

  SCR-03                  Payment                 QR, tiền mặt, xác nhận
                                                  thanh toán trong khu
                                                  vực POS

  SCR-04                  Sales History           Tra cứu và xuất giao
                                                  dịch

  SCR-05                  Dashboard               Thống kê lượt khách,
                                                  mặt hàng bán chạy

  SCR-06                  Product Catalog         Quản lý thuốc, hàng
                                                  hóa, giá và nhập Excel
  -----------------------------------------------------------------------

Màn hình thanh toán có thể hiển thị trong cột giỏ hàng thay vì chuyển
sang một trang độc lập, phù hợp nguyên tắc giảm số lần chạm.

------------------------------------------------------------------------

## 6. Yêu cầu dữ liệu (Data Requirements)

### 6.1. Các thực thể dữ liệu chính

Mô hình dữ liệu logic đề xuất:

``` mermaid
erDiagram
    PHARMACIST ||--o{ SALES_ORDER : creates
    CUSTOMER o|--o{ SALES_ORDER : places
    SALES_ORDER ||--|{ ORDER_ITEM : contains
    PRODUCT ||--o{ ORDER_ITEM : references
    SALES_ORDER ||--o| PAYMENT : paid_by
    SALES_ORDER ||--o{ RECONCILIATION : tracked_in

    PHARMACIST {
        string seller_id PK
        string full_name
        string email
        string role
    }
    CUSTOMER {
        string customer_id PK
        string name
        string pid
    }
    PRODUCT {
        string product_code PK
        string product_name
        string category
        string warehouse
        decimal price
        string unit
        int stock
    }
    SALES_ORDER {
        string order_id PK
        string seller_id FK
        string customer_id FK
        datetime created_at
        decimal total_amount
        string order_status
    }
    ORDER_ITEM {
        string item_id PK
        string order_id FK
        string product_code FK
        string lot
        string unit
        int quantity
        decimal unit_price
    }
    PAYMENT {
        string payment_id PK
        string order_id FK
        string method
        string status
        decimal amount
    }
    RECONCILIATION {
        string reconciliation_id PK
        string order_id FK
        string system_name
        string status
    }
```

Đây là mô hình dữ liệu logic đề xuất, không phải cấu trúc database hiện
có trong file HTML.

### 6.2. Yêu cầu lưu trữ

-   Không bị ghi đè giao dịch cũ.
-   Không mất lịch sử khi dược sĩ chuyển tài khoản.
-   Có thể xác định thời gian và người tạo giao dịch.
-   Lưu được chi tiết từng dòng thuốc/hàng hóa.
-   Có cơ chế phục hồi hoặc đồng bộ giao dịch chưa được gửi lên máy chủ
    khi mất mạng.
-   Có lịch sử thay đổi đối với thông tin quan trọng.

Với prototype, dữ liệu có thể lưu cục bộ để mô phỏng. Với phiên bản vận
hành thực tế, cần có cơ sở dữ liệu tập trung, phân quyền và cơ chế đồng
bộ có kiểm soát.

------------------------------------------------------------------------

## 7. Yêu cầu phi chức năng (Non-functional Requirements)

Các chỉ tiêu dưới đây là **mục tiêu thiết kế đề xuất**, cần kiểm chứng
khi kiểm thử thực tế.

  -----------------------------------------------------------------------
  ID                      Nhóm                    Yêu cầu
  ----------------------- ----------------------- -----------------------
  NFR-01                  Hiệu năng               Kết quả tìm kiếm thuốc
                                                  hiển thị trong khoảng 1
                                                  giây với danh mục thử
                                                  nghiệm

  NFR-02                  Hiệu năng               Thao tác tăng/giảm số
                                                  lượng và tính tiền phản
                                                  hồi gần như tức thời

  NFR-03                  Usability               Quy trình chọn một mặt
                                                  hàng có sẵn, nhập số
                                                  lượng và chuyển đến
                                                  thanh toán cần ít thao
                                                  tác

  NFR-04                  Responsive              Hỗ trợ tablet và
                                                  desktop, ưu tiên độ
                                                  rộng từ 1024 px

  NFR-05                  Accessibility           Vùng chạm chính tối
                                                  thiểu 48 × 48 dp

  NFR-06                  Reliability             Không tạo giao dịch
                                                  trùng khi gửi xác nhận
                                                  thanh toán lặp lại

  NFR-07                  Offline                 Lưu đơn nháp khi mất
                                                  mạng và xử lý đồng bộ
                                                  khi kết nối trở lại

  NFR-08                  Security                Xác thực người dùng,
                                                  phân quyền, bảo vệ dữ
                                                  liệu giao dịch

  NFR-09                  Auditability            Lưu lịch sử thao tác
                                                  điều chỉnh giá, tồn kho
                                                  và giao dịch

  NFR-10                  Data Integrity          Bảo đảm tổng tiền, số
                                                  lượng và dữ liệu xuất
                                                  Excel khớp giao dịch
                                                  gốc

  NFR-11                  Maintainability         Có thể cập nhật danh
                                                  mục, giá và quy tắc
                                                  nghiệp vụ mà không cần
                                                  thiết kế lại toàn bộ UI
  -----------------------------------------------------------------------

**Lưu ý về offline:** Mất mạng không đồng nghĩa hệ thống vẫn có thể xác
minh chuyển khoản ngân hàng hoặc cập nhật tồn kho SAP/OH. Các bước cần
kết nối phải hiển thị đúng trạng thái chờ xử lý và không được giả lập là
đã hoàn tất.

------------------------------------------------------------------------

## 8. Quy tắc nghiệp vụ và xử lý ngoại lệ

  -----------------------------------------------------------------------
  Tình huống                          Hành vi hệ thống mong đợi
  ----------------------------------- -----------------------------------
  Khách không có PID                  Cho phép tiếp tục bán

  Không tìm thấy thuốc                Hiển thị thông báo và gợi ý tìm
                                      kiếm gần đúng

  Thuốc hết hàng                      Không cho phép thêm số lượng vượt
                                      tồn khả dụng

  Thuốc hết hạn                       Không cho phép bán

  Thuốc cùng tên, khác hàm lượng      Hiển thị rõ mã và hàm lượng để lựa
                                      chọn

  Giá bán chưa được thiết lập         Không cho phép hoàn tất bán khi
                                      chưa xác minh giá

  Thay đổi đơn vị tính                Kiểm tra quy đổi số lượng và đơn
                                      giá

  Khách chuyển khoản thiếu tiền       Không tự động hoàn tất

  Khách chuyển khoản nhưng chưa xác   Giữ trạng thái chờ xác minh
  minh                                

  Mất mạng                            Lưu đơn nháp cục bộ, hiển thị trạng
                                      thái kết nối

  Dược sĩ đổi tài khoản               Lưu nháp và xác thực người dùng mới

  Nhấn thanh toán nhiều lần           Không tạo nhiều bản ghi cho cùng
                                      một lần bán

  Giao dịch đã lưu nhưng chưa nhập    Hiển thị trạng thái chờ đối soát
  SAP                                 

  Excel nhập sai định dạng            Hiển thị lỗi theo dòng và không cập
                                      nhật dữ liệu không hợp lệ
  -----------------------------------------------------------------------

------------------------------------------------------------------------

## 9. Tiêu chí nghiệm thu (Acceptance Criteria)

Checklist nghiệm thu MVP:

-   [ ] Đăng nhập thành công bằng tài khoản dược sĩ được cấp.
-   [ ] Mã đơn thay đổi và không trùng khi tạo đơn mới.
-   [ ] Tìm kiếm thuốc được khi nhập gần đúng hoặc không dấu.
-   [ ] Chỉ bán mặt hàng thuộc danh mục cho phép.
-   [ ] Hiển thị đầy đủ mã thuốc, tên, kho, đơn vị, giá, tồn và hạn
    dùng.
-   [ ] Thêm được nhiều loại thuốc vào cùng đơn.
-   [ ] Thay đổi số lượng và tổng tiền được tính lại chính xác.
-   [ ] Ghi được tên người bán hàng hóa đặc biệt.
-   [ ] Hiển thị chính xác số tiền cần thanh toán qua QR hoặc tiền mặt.
-   [ ] Giao dịch hoàn tất được lưu kèm mã đơn và tài khoản người bán.
-   [ ] Tra cứu được giao dịch theo mã đơn, người bán, thời gian và tên
    thuốc.
-   [ ] Xuất được dữ liệu chi tiết giao dịch mở bằng Excel.
-   [ ] Thống kê được lượt mua và mặt hàng bán chạy.
-   [ ] Đơn không mất dữ liệu khi xảy ra lỗi thao tác thông thường.

------------------------------------------------------------------------

## 10. Các chỉ số đánh giá hiệu quả sản phẩm (Success Metrics)

  -----------------------------------------------------------------------
  KPI                     Cách đo                 Mục đích
  ----------------------- ----------------------- -----------------------
  Thời gian tạo một đơn   Từ khi bắt đầu đến khi  Đánh giá tốc độ bán
                          lưu giao dịch           hàng

  Số thao tác trung       Số lần chạm/click cần   Đánh giá UX
  bình/đơn                thiết                   

  Tỷ lệ giao dịch được    Số giao dịch có bản ghi Đánh giá khả năng hạn
  ghi nhận                / Tổng giao dịch thực   chế bỏ sót
                          tế                      

  Tỷ lệ giao dịch thiếu   Số giao dịch thiếu      Đánh giá chất lượng dữ
  thông tin               trường bắt buộc / Tổng  liệu
                          giao dịch               

  Thời gian truy vết giao Thời gian tìm ra một    Đánh giá khả năng tra
  dịch                    giao dịch cần đối soát  cứu

  Tỷ lệ giao dịch chờ     Số giao dịch chưa cập   Đánh giá công tác đối
  SAP/OH                  nhật / Tổng giao dịch   soát
                          đã bán                  

  Độ chính xác            Số lần nhận dạng đúng / Đánh giá hỗ trợ nhập
  Speech-to-text          Tổng lượt thử           liệu

  Mức độ hài lòng của     Khảo sát sau sử dụng    Đánh giá tính phù hợp
  dược sĩ                 thử                     thực tế
  -----------------------------------------------------------------------

Không nên tự đặt kết quả cải thiện trước khi có số liệu thử nghiệm. Nhóm
có thể đặt mục tiêu ban đầu về mức giảm thời gian thao tác, sau đó kiểm
chứng với dược sĩ trong các ca có lượng khách khác nhau.

------------------------------------------------------------------------

## 11. Phân chia phạm vi triển khai MVP

### Phase 1 -- MVP

Đăng nhập, tạo mã đơn, tìm kiếm thuốc, quản lý giỏ hàng, QR/tiền mặt,
lưu lịch sử giao dịch, xuất Excel và thống kê cơ bản.

**Kết quả:** Có thể thực hiện một giao dịch bán lẻ hoàn chỉnh trên
prototype và tra cứu lại dữ liệu.

### Phase 2 -- Cải thiện thao tác

Nhập Excel danh mục, sao chép đơn cũ, Speech-to-text, lưu đơn nháp, phân
quyền chi tiết và lọc báo cáo nâng cao.

**Kết quả:** Giảm thời gian thao tác và hỗ trợ dược sĩ khi nhà thuốc
đông khách.

### Phase 3 -- Tích hợp hệ thống

Đồng bộ với SAP/OH, đối soát trạng thái cập nhật tồn kho, tích hợp xác
nhận thanh toán ngân hàng và quản lý offline đa thiết bị.

**Kết quả:** Hạn chế thao tác cập nhật trùng lặp giữa hệ thống bán lẻ và
hệ thống hiện có.

------------------------------------------------------------------------

## 12. Rủi ro và phụ thuộc

  -----------------------------------------------------------------------
  Rủi ro                  Ảnh hưởng               Hướng xử lý
  ----------------------- ----------------------- -----------------------
  Dữ liệu giá không cập   Sai số tiền bán         Có nguồn giá chính thức
  nhật                                            và phân quyền cập nhật

  Tồn kho không đồng bộ   Có thể bán vượt tồn     Kiểm tra tồn trước khi
                                                  hoàn tất và đối soát
                                                  SAP/OH

  Trùng mã giao dịch      Sai lệch lịch sử        Sinh mã đơn duy nhất ở
                                                  hệ thống tập trung

  Nhận dạng sai tên thuốc Nguy cơ chọn sai sản    Bắt buộc xác nhận kết
                          phẩm                    quả Speech-to-text

  QR chưa được xác nhận   Ghi nhận sai trạng thái Đối chiếu giao dịch
                          thanh toán              ngân hàng hoặc xác minh
                                                  thủ công theo quy trình

  Dữ liệu chỉ lưu tại     Mất dữ liệu khi xóa bộ  Database tập trung và
  trình duyệt             nhớ thiết bị            cơ chế đồng bộ

  Sửa giá hoặc danh mục   Khó kiểm soát nghiệp vụ Phân quyền, duyệt thay
  tùy ý                                           đổi và audit log

  File Excel không đúng   Không thể nhập vào      Xác nhận cấu trúc với
  mẫu                     SAP/OH                  bộ phận IT và khoa Dược
  -----------------------------------------------------------------------

------------------------------------------------------------------------

## 13. Các vấn đề cần xác nhận với stakeholder (Open Questions)

1.  **Nguồn danh mục thuốc:** Danh sách thuốc OTC, thực phẩm chức năng,
    vật tư y tế và giá bán được lấy từ SAP, OH hay một file danh mục do
    nhà thuốc quản lý?
2.  **Đơn vị bán:** Các loại thuốc bán theo viên, vỉ, hộp có quy tắc quy
    đổi số lượng và giá như thế nào? Ai có quyền thay đổi?
3.  **Quản lý giá:** Dược sĩ được chỉnh sửa giá bán trực tiếp trong đơn
    hay chỉ quản lý được danh mục giá sau khi có phê duyệt?
4.  **Thanh toán:** Khoa Dược sử dụng tài khoản ngân hàng nào để nhận
    QR? Có thể tích hợp dữ liệu xác nhận thanh toán hay phải kiểm tra
    thủ công?
5.  **Hàng hóa đặc biệt:** Những mặt hàng nào được xếp vào nhóm đặc
    biệt? Trường "Tên người bán" là tên người trực tiếp bán hay người
    chịu trách nhiệm hàng hóa?
6.  **Truy vết SAP/OH:** Nhóm có thể nhận được file mẫu hoặc dữ liệu
    xuất từ hệ thống hiện tại để mapping các trường hay không?
7.  **Thống kê:** Số lượt khách cần tính theo số đơn hoàn tất hay số
    khách duy nhất? Các giao dịch hoàn tiền, hủy đơn được xử lý trong
    báo cáo như thế nào?
8.  **Speech-to-text:** Có được phép xử lý âm thanh bằng dịch vụ AI bên
    ngoài bệnh viện không? Dữ liệu nào được phép lưu vào nhật ký?
9.  **Phân quyền:** Dược sĩ nào được quyền thêm, sửa, ngừng bán sản phẩm
    và thay đổi giá?
10. **Thiết bị:** Nhà thuốc sử dụng tablet, máy tính cố định hay cả hai?
    Thiết bị có microphone và kết nối mạng ổn định không?

------------------------------------------------------------------------

## 14. Kết luận

Sản phẩm **Vinmec Retail Pharmacy** được đề xuất nhằm giải quyết vấn đề
thiếu lịch sử giao dịch bán thuốc cho khách mua lẻ, từ đó giảm nguy cơ
bỏ sót việc cập nhật tồn kho và hỗ trợ công tác đối soát tại nhà thuốc.

Giải pháp tập trung vào ba giá trị chính:

-   **Nhanh:** Dược sĩ tìm thuốc, nhập số lượng và thanh toán trên một
    giao diện tối giản.
-   **Dễ truy vết:** Mỗi đơn hàng gắn với mã giao dịch, người bán, thời
    gian và chi tiết từng mặt hàng.
-   **Hỗ trợ đối soát:** Lịch sử giao dịch được lưu và xuất thành dữ
    liệu có cấu trúc để phục vụ cập nhật SAP/OH.

Đối với giai đoạn prototype, nhóm nên ưu tiên bảo đảm luồng bán thuốc
hoạt động chính xác, dữ liệu giao dịch được ghi nhận đầy đủ và có thể
xuất Excel. Các chức năng AI như Speech-to-text đóng vai trò nâng cao
trải nghiệm, không thay thế kiểm tra của dược sĩ.

**Trạng thái PRD:** Bản dự thảo đủ để nhóm BA và phát triển phần mềm rà
soát phạm vi MVP, nhưng cần xác nhận thêm quy trình thanh toán, quản lý
giá, quy đổi đơn vị và tích hợp SAP/OH trước khi chốt yêu cầu triển khai
thực tế.

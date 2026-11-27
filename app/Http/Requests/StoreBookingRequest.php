<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreBookingRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'match_slug' => ['required', 'string', 'max:120'],
            'sector_code' => ['required', 'string', 'max:4'],
            'row_number' => ['required', 'integer', 'min:1', 'max:50'],
            'seat_number' => ['required', 'integer', 'min:1', 'max:60'],
            'ticket_count' => ['required', 'integer', 'min:1', 'max:4'],
            'buyer_name' => ['required', 'string', 'min:3', 'max:120'],
            'buyer_email' => ['required', 'email', 'max:160'],
            'buyer_phone' => ['required', 'string', 'min:8', 'max:24'],
            'payment_method' => [
                'required',
                'string',
                Rule::in([
                    'Transfer Bank Virtual',
                    'Dompet Digital',
                    'Kartu Debit atau Kredit',
                ]),
            ],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'buyer_name.required' => 'Nama lengkap pemesan wajib diisi.',
            'buyer_name.min' => 'Nama lengkap minimal 3 karakter.',
            'buyer_email.required' => 'Alamat surel wajib diisi untuk pengiriman tiket elektronik.',
            'buyer_email.email' => 'Format alamat surel tidak valid.',
            'buyer_phone.required' => 'Nomor telepon aktif wajib diisi.',
            'buyer_phone.min' => 'Nomor telepon minimal 8 digit.',
            'payment_method.in' => 'Pilih salah satu metode pembayaran yang tersedia.',
        ];
    }
}

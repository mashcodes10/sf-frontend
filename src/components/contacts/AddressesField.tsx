"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import Button from "@/components/ui/Button";
import Field, { CONTROL } from "@/components/ui/Field";
import {
  ADDRESS_FIELDS,
  MAX_ADDRESSES,
  addressInputName,
} from "@/lib/contacts/schema";
import { ADDRESS_TYPES, type AddressFormValues } from "@/lib/contacts/types";

const EMPTY_ROW: AddressFormValues = {
  type: "Home",
  address: "",
  city: "",
  state: "",
  postal_code: "",
  country: "",
};

type Row = { key: number; initial: AddressFormValues };

/**
 * Editable list of a contact's addresses. Each row is a block of plain form
 * inputs named `addresses.<position>.<field>`, so the whole list submits as
 * regular form data — no client-side serialisation, works before hydration
 * for the rows that were server-rendered.
 */
export default function AddressesField({
  defaultValue,
  error,
}: {
  defaultValue: AddressFormValues[];
  error?: string;
}) {
  const [rows, setRows] = useState<Row[]>(() =>
    defaultValue.map((initial, key) => ({ key, initial })),
  );
  const [nextKey, setNextKey] = useState(defaultValue.length);

  function addRow() {
    setRows((current) => [...current, { key: nextKey, initial: EMPTY_ROW }]);
    setNextKey((key) => key + 1);
  }

  function removeRow(key: number) {
    setRows((current) => current.filter((row) => row.key !== key));
  }

  return (
    <div className="space-y-4">
      {rows.map((row, index) => {
        const typeId = `address-${row.key}-type`;

        return (
          <div
            key={row.key}
            className="space-y-4 rounded-lg border border-border bg-card/50 p-4"
          >
            <div className="flex items-end justify-between gap-2">
              <div className="w-40">
                <label
                  htmlFor={typeId}
                  className="mb-1.5 block text-[13px] font-medium text-foreground"
                >
                  Type
                </label>
                <select
                  id={typeId}
                  name={addressInputName(index, "type")}
                  defaultValue={row.initial.type}
                  className={`${CONTROL} border-border focus:border-primary`}
                >
                  {ADDRESS_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <Button
                variant="ghost"
                size="sm"
                aria-label={`Remove address ${index + 1}`}
                onClick={() => removeRow(row.key)}
              >
                <X className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                Remove
              </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {ADDRESS_FIELDS.map((field) => (
                <Field
                  key={field.name}
                  field={{ ...field, name: addressInputName(index, field.name) }}
                  defaultValue={row.initial[field.name]}
                />
              ))}
            </div>
          </div>
        );
      })}

      {rows.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">
          No addresses yet.
        </p>
      ) : null}

      <Button
        variant="secondary"
        size="sm"
        onClick={addRow}
        disabled={rows.length >= MAX_ADDRESSES}
      >
        <Plus className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
        Add address
      </Button>

      {error ? (
        <p role="alert" className="text-[13px] text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

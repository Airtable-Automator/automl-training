import React, { useState, useEffect } from 'react';
import { Select } from '@airtable/blocks/ui';
import { SelectOption } from '@airtable/blocks/dist/types/src/ui/select_and_select_buttons_helpers';
import { WidthProperty } from '@airtable/blocks/dist/types/src/ui/system/utils/csstype';
import { Length } from '@airtable/blocks/dist/types/src/ui/system/utils/types';

type AsyncSelectProps = {
  loadOptions: () => Promise<Array<SelectOption>>,
  onChange: (SelectOptionValue) => void,
  width?: WidthProperty<Length>,
}

export function AsyncSelect({ loadOptions, onChange, width }: AsyncSelectProps) {
  const [options, setOptions] = useState<Array<SelectOption>>([{ value: "__PLACEHOLDER__", label: "Loading..." }]);
  const [value, setValue] = useState(options[0].value);
  const [isLoaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!isLoaded) {
      loadOptions().then(function (options: Array<SelectOption>) {
        setLoaded(true);
        console.log(options);
        setOptions(options);
        setValue(options[0].value);
      });
    }
  }, [isLoaded])

  return (
    <Select
      value={value}
      options={options}
      onChange={(e) => {
        setValue(e);
        onChange(e);
      }}
      width={width}
    />
  );
}